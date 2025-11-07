const app = require('./service.js');
const { sendMetricsPeriodically } = require('./metrics.js');

const port = process.argv[2] || 3001;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  // Start sending metrics to Grafana every 30 seconds
  sendMetricsPeriodically(30000);
});
