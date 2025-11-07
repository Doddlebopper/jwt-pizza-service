const os = require('os');
const config = require('./config.js');

// Track CPU usage over time for Windows compatibility
let previousCpuUsage = null;
let previousCpuTime = Date.now();

const httpMetrics = {
  totalRequests: 0,
  requestsByMethod: {},
  requestsByStatus: {},
  totalLatency: 0,
};

function getSystemMetrics() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercentage = (usedMemory / totalMemory) * 100;

  // Calculate CPU usage
  let cpuUsage = 0;
  try {
    const loadAvg = os.loadavg();
    if (loadAvg && loadAvg.length > 0 && loadAvg[0] > 0) {
      // On Linux/Unix: loadavg[0] is 1-minute load average
      cpuUsage = (loadAvg[0] / os.cpus().length) * 100;
    } else {
      // On Windows: use process.cpuUsage() with time tracking
      const currentCpuUsage = process.cpuUsage(previousCpuUsage);
      const currentTime = Date.now();
      const timeDelta = currentTime - previousCpuTime;
      
      if (previousCpuUsage && timeDelta > 0) {
        // Calculate CPU percentage: (cpu time / wall clock time) * 100
        const cpuTimeDelta = currentCpuUsage.user + currentCpuUsage.system;
        const cpuPercent = (cpuTimeDelta / (timeDelta * 1000)) * 100; // Convert to percentage
        cpuUsage = Math.min(cpuPercent, 100); // Cap at 100%
      }
      
      // Store for next calculation
      previousCpuUsage = process.cpuUsage();
      previousCpuTime = currentTime;
    }
  } catch {
    // Fallback: return 0 if calculation fails
    cpuUsage = 0;
  }

  return {
    cpuUsage: parseFloat(cpuUsage.toFixed(2)),
    memoryUsage: parseFloat(memoryUsagePercentage.toFixed(2)),
    totalMemory,
    usedMemory,
  };
}

const userMetrics = {
  totalUsers: 0,
  activeUsers: 0,
  totalUserUpdates: 0,
};

const purchaseMetrics = {
  totalPurchases: 0,
  successfulPurchases: 0,
  failedPurchases: 0,
  totalLatency: 0,
  totalPrice: 0,
  totalPizzas: 0,
};

const authMetrics = {
  totalLogins: 0,
  totalLogouts: 0,
  totalRegistrations: 0,
  failedLogins: 0,
};

function requestTracker(req, res, next) {
  const startTime = Date.now();
  
  httpMetrics.totalRequests++;
  const method = req.method;
  httpMetrics.requestsByMethod[method] = (httpMetrics.requestsByMethod[method] || 0) + 1;

  res.on('finish', () => {
    const latency = Date.now() - startTime;
    httpMetrics.totalLatency += latency;
    const statusCategory = `${Math.floor(res.statusCode / 100)}xx`;
    httpMetrics.requestsByStatus[statusCategory] = (httpMetrics.requestsByStatus[statusCategory] || 0) + 1;
  });

  next();
}

function pizzaPurchase(success, latency, price, count = 1) {
  purchaseMetrics.totalPurchases++;
  
  if (success) {
    purchaseMetrics.successfulPurchases++;
  } else {
    purchaseMetrics.failedPurchases++;
  }
  
  purchaseMetrics.totalLatency += latency;
  purchaseMetrics.totalPrice += price;
  purchaseMetrics.totalPizzas += count;
}

// Auth tracking functions
function trackLogin(success) {
  if (success) {
    authMetrics.totalLogins++;
    userMetrics.activeUsers = Math.max(0, authMetrics.totalLogins - authMetrics.totalLogouts);
  } else {
    authMetrics.failedLogins++;
  }
}

function trackLogout() {
  authMetrics.totalLogouts++;
  userMetrics.activeUsers = Math.max(0, authMetrics.totalLogins - authMetrics.totalLogouts);
}

function trackRegistration() {
  authMetrics.totalRegistrations++;
  userMetrics.totalUsers++;
}

class OtelMetricBuilder {
  constructor() {
    this.metrics = [];
  }

  add(metricData) {
    this.metrics.push(metricData);
    return this;
  }

  _flattenMetrics(metricObj, prefix = '') {
    const flattened = [];
    for (const [key, value] of Object.entries(metricObj)) {
      const metricName = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested objects like requestsByMethod
        if (key === 'requestsByMethod' || key === 'requestsByStatus') {
          for (const [subKey, subValue] of Object.entries(value)) {
            flattened.push({
              name: metricName,
              value: subValue,
              labels: { [key === 'requestsByMethod' ? 'method' : 'status']: subKey },
            });
          }
        } else {
          flattened.push(...this._flattenMetrics(value, metricName));
        }
      } else if (typeof value === 'number' || typeof value === 'string') {
        flattened.push({
          name: metricName,
          value: typeof value === 'string' ? parseFloat(value) || 0 : value,
        });
      }
    }
    return flattened;
  }

  async sendToGrafana() {
    // Flatten all metrics into individual data points
    const allMetrics = [];
    for (const metricObj of this.metrics) {
      allMetrics.push(...this._flattenMetrics(metricObj));
    }

    const now = Date.now();
    const timestampNs = now * 1000000; // Convert to nanoseconds

    // Convert to OTLP format
    const resourceMetrics = allMetrics.map(metric => {
      const numValue = typeof metric.value === 'number' ? metric.value : parseFloat(metric.value) || 0;
      const isInteger = Number.isInteger(numValue);
      const attributes = metric.labels ? Object.entries(metric.labels).map(([k, v]) => ({ key: k, value: { stringValue: v } })) : [];
      
      const dataPoint = {
        attributes: attributes,
        timeUnixNano: timestampNs.toString(),
      };
      
      // Use correct field for integer vs float
      if (isInteger) {
        dataPoint.asInt = numValue.toString();
      } else {
        dataPoint.asDouble = numValue;
      }

      const metricObj = {
        name: metric.name,
        description: `${metric.name} metric`,
        unit: '',
      };

      // Use sum for counters, gauge for values
      const isCounter = metric.name.includes('total') || metric.name.includes('Requests') || 
                       metric.name.includes('Purchases') || metric.name.includes('Logins') ||
                       metric.name.includes('Updates');
      
      if (isCounter) {
        metricObj.sum = {
          dataPoints: [dataPoint],
          aggregationTemporality: 2, // AGGREGATION_TEMPORALITY_CUMULATIVE
          isMonotonic: true,
        };
      } else {
        metricObj.gauge = {
          dataPoints: [dataPoint],
        };
      }

      return metricObj;
    });

    // OTLP JSON format
    const payload = {
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'jwt-pizza-service' } },
          ],
        },
        scopeMetrics: [{
          scope: {},
          metrics: resourceMetrics.filter(m => m.sum || m.gauge),
        }],
      }],
    };

    const grafanaUrl = config.metrics?.url || process.env.GRAFANA_URL;
    
    if (!grafanaUrl) {
      console.log('Grafana URL not configured, skipping metrics send');
      return;
    }

    try {
      // Grafana Cloud OTLP uses Basic auth with instance ID:token format
      const apiKey = config.metrics?.apiKey || '';
      const [instanceId, token] = apiKey.split(':');
      const authHeader = token 
        ? `Basic ${Buffer.from(`${instanceId}:${token}`).toString('base64')}`
        : `Bearer ${apiKey}`;
      
      const response = await fetch(grafanaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Failed to send metrics to Grafana: ${response.status} ${response.statusText}`, errorText.substring(0, 200));
      } else {
        const responseText = await response.text();
        console.log(`Successfully sent ${allMetrics.length} metrics to Grafana (response: ${responseText.substring(0, 100)})`);
        console.log(`Sample metric names: ${allMetrics.slice(0, 5).map(m => m.name).join(', ')}`);
      }
    } catch (error) {
      console.log('Error sending metrics to Grafana:', error.message);
    }
  }
}

function sendMetricsPeriodically(period) {
  console.log(`Starting metrics collection, will send to Grafana every ${period / 1000} seconds`);
  
  const sendMetrics = async () => {
    try {
      // Recalculate activeUsers before sending
      userMetrics.activeUsers = Math.max(0, authMetrics.totalLogins - authMetrics.totalLogouts);
      
      const metrics = new OtelMetricBuilder();
      metrics.add(httpMetrics);
      metrics.add(getSystemMetrics());
      metrics.add(userMetrics);
      metrics.add(purchaseMetrics);
      metrics.add(authMetrics);

      // Debug logging
      console.log(`Metrics snapshot - Logins: ${authMetrics.totalLogins}, Logouts: ${authMetrics.totalLogouts}, Active: ${userMetrics.activeUsers}`);

      await metrics.sendToGrafana();
    } catch (error) {
      console.log('Error sending metrics', error);
    }
  };
  
  // Send immediately on start
  sendMetrics();

  const timer = setInterval(sendMetrics, period);

  return timer;
}

module.exports = {
  requestTracker,
  pizzaPurchase,
  trackLogin,
  trackLogout,
  trackRegistration,
  sendMetricsPeriodically,
};
