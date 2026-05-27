const b64 = 'data:application/pdf;base64,JVBERi0xLjQK';
const buf = Buffer.from(b64, 'base64');
console.log(buf.toString('utf8'));
