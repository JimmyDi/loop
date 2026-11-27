const icnsSizes = [
  ["icp4", 16],
  ["icp5", 32],
  ["ic11", 32],
  ["ic12", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic13", 256],
  ["ic09", 512],
  ["ic14", 512],
  ["ic10", 1024],
] as const;

const icoSizes = [16, 24, 32, 48, 64, 256];

export const desktopIconSizes = [...new Set([...icnsSizes.map(([, size]) => size), ...icoSizes])];

type ReadPng = (size: number) => Buffer;

export const encodeIcns = (png: ReadPng): Buffer => {
  const chunks = icnsSizes.map(([type, size]) => {
    const image = png(size);
    const header = Buffer.alloc(8);
    header.write(type, "ascii");
    header.writeUInt32BE(header.length + image.length, 4);
    return [header, image];
  });
  const header = Buffer.alloc(8);
  header.write("icns", "ascii");
  const file = Buffer.concat([header, ...chunks.flat()]);
  file.writeUInt32BE(file.length, 4);
  return file;
};

export const encodeIco = (png: ReadPng): Buffer => {
  const directory = Buffer.alloc(6 + icoSizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(icoSizes.length, 4);
  let offset = directory.length;
  const images = icoSizes.map((size, index) => {
    const image = png(size);
    const entry = 6 + index * 16;
    directory[entry] = directory[entry + 1] = size % 256;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.length;
    return image;
  });
  return Buffer.concat([directory, ...images]);
};
