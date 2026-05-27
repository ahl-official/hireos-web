module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    service: 'American Hairline Candidate Portal',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};
