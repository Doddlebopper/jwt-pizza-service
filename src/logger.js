const config = require('./config.js');


function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return `::ffff:${ip}`;
    }
    return ip;
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    if (realIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(realIp)) {
      return `::ffff:${realIp}`;
    }
    return realIp;
  }
  
  const ip = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip;
  
  if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return `::ffff:${ip}`;
  }
  
  return ip || 'unknown';
}

function sanitize(logData) {
  const logString = JSON.stringify(logData);
  return logString.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
}

function nowString() {
  return (Math.floor(Date.now()) * 1000000).toString();
}

async function sendLogToGrafana(level, type, logData) {
  const lokiConfig = config.logging;
  
  if (!lokiConfig || !lokiConfig.url) {
    console.log('Loki URL not configured, skipping log send');
    return;
  }

  const labels = {
    component: lokiConfig.source || 'jwt-pizza-service',
    level: level || 'info',
    type: type || 'unknown',
  };
  
  const sanitizedLog = sanitize(logData);
  const values = [nowString(), sanitizedLog];
  const logEvent = {
    streams: [{
      stream: labels,
      values: [values],
    }],
  };
  
  if (type === 'http') {
    console.log('Sending HTTP log:', sanitizedLog.substring(0, 200));
  }

  try {
    const apiKey = lokiConfig.apiKey || '';
    const userId = lokiConfig.userId || '';
    
    const body = JSON.stringify(logEvent);
    const response = await fetch(lokiConfig.url, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userId}:${apiKey}`,
      },
    });

    if (!response.ok) {
      console.log('Failed to send log to Grafana');
    }
  } catch (error) {
    console.log('Error sending log to Grafana Loki:', error.message);
  }
}

function logHttpRequest(req, res, reqBody, resBody) {
  const ip = getClientIp(req);
  const isAuthenticated = !!req.user;
  
  const logData = {
    authorized: isAuthenticated,
    path: req.path || req.url || req.originalUrl,
    method: req.method,
    statusCode: res.statusCode,
    reqBody: reqBody ? (typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody)) : '{}',
    resBody: resBody ? (typeof resBody === 'string' ? resBody : JSON.stringify(resBody)) : '{}',
    ip: ip,
  };
  
  const level = res.statusCode >= 400 ? 'warn' : 'info';
  sendLogToGrafana(level, 'http', logData).catch(err => {
    console.log('Error in logHttpRequest:', err.message);
  });
}

function logDbQuery(sql, params) {
  const logData = {
    req: sql + (params && params.length > 0 ? ` [${params.join(', ')}]` : ''),
  };
  
  sendLogToGrafana('info', 'db', logData).catch(err => {
    console.log('Error in logDbQuery:', err.message);
  });
}

module.exports = {
  sendLogToGrafana,
  logHttpRequest,
  logDbQuery,
  getClientIp,
};