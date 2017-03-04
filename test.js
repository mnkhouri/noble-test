var buf = new Buffer(4);

buf[0] = 0x4C;
buf[1] = 0x00;

console.log(buf.readUInt16BE(0));
console.log(buf.readUInt16LE(0));
