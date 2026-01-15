const stage = document.getElementById("stage");
const hint = document.getElementById("hint");
const imageWrap = document.getElementById("imageWrap");
const sourceImage = document.getElementById("sourceImage");
const hoverLine = document.getElementById("hoverLine");
const hoverLabel = document.getElementById("hoverLabel");
const sliceLayer = document.getElementById("sliceLayer");
const sliceButton = document.getElementById("sliceButton");
const fileInput = document.getElementById("fileInput");
const hintText = document.getElementById("hintText");

let imageMeta = null;
let slicePoints = [];
let dragState = null;
let dragCounter = 0;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const resetState = () => {
  slicePoints = [];
  sliceLayer.innerHTML = "";
  sliceButton.disabled = true;
  sliceButton.style.display = "none";
};

const setDragActive = (isActive) => {
  stage.classList.toggle("drag-over", isActive);
  if (isActive) {
    const label = imageMeta ? "Release to replace" : "Release to add";
    hint.setAttribute("aria-label", label);
    hintText.textContent = label;
    hint.style.display = "flex";
  } else {
    hint.setAttribute("aria-label", "Drop an image anywhere");
    hint.style.display = imageMeta ? "none" : "flex";
  }
};

const showImage = (fileName, dataUrl) => {
  resetState();
  hint.style.display = "none";
  imageWrap.style.display = "flex";
  sourceImage.src = dataUrl;
  sourceImage.onload = () => {
    const displayHeight = sourceImage.clientHeight;
    const displayWidth = sourceImage.clientWidth;
    const baseName = fileName?.replace(/\.[^/.]+$/, "") || "image";
    imageMeta = {
      name: fileName || "image",
      baseName,
      naturalWidth: sourceImage.naturalWidth,
      naturalHeight: sourceImage.naturalHeight,
      displayWidth,
      displayHeight,
      scale: sourceImage.naturalHeight / displayHeight,
    };
    hoverLine.style.top = "-9999px";
    hoverLabel.style.top = "-9999px";
    sliceButton.disabled = false;
    sliceButton.style.display = "inline-flex";
    syncSlicePointsToImage();
  };
};

const getImageRects = () => {
  const imageRect = sourceImage.getBoundingClientRect();
  const wrapRect = imageWrap.getBoundingClientRect();
  return {
    imageRect,
    wrapRect,
    offsetY: imageRect.top - wrapRect.top,
  };
};

const syncSlicePointsToImage = () => {
  if (!imageMeta) {
    return;
  }
  const { imageRect, offsetY } = getImageRects();
  if (!imageRect.height) {
    return;
  }
  const scale = imageMeta.naturalHeight / imageRect.height;
  imageMeta.displayWidth = imageRect.width;
  imageMeta.displayHeight = imageRect.height;
  imageMeta.scale = scale;
  slicePoints = slicePoints.map((point) => ({
    ...point,
    displayY: point.naturalY / scale + offsetY,
  }));
  renderSlicePoints();
};

const getRelativeY = (event) => {
  const { imageRect } = getImageRects();
  return clamp(event.clientY - imageRect.top, 0, imageRect.height);
};

const addSlicePoint = (imageY) => {
  const { imageRect, offsetY } = getImageRects();
  const scale = imageMeta.naturalHeight / imageRect.height;
  const clampedY = clamp(imageY, 0, imageRect.height);
  const naturalY = Math.round(clampedY * scale);
  const point = {
    id: crypto.randomUUID(),
    displayY: clampedY + offsetY,
    naturalY,
  };
  slicePoints.push(point);
  renderSlicePoints();
};

const renderSlicePoints = () => {
  sliceLayer.innerHTML = "";
  slicePoints.forEach((point) => {
    const element = document.createElement("div");
    element.className = "slice-point";
    element.style.top = `${point.displayY}px`;
    element.style.transform = "translateY(-0.5px)";
    element.dataset.id = point.id;

    const handle = document.createElement("div");
    handle.className = "move-handle";
    handle.textContent = "↕";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "×";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      slicePoints = slicePoints.filter((item) => item.id !== point.id);
      renderSlicePoints();
    });

    element.addEventListener("pointerdown", (event) => {
      if (event.target === remove) {
        return;
      }
      dragState = {
        id: point.id,
      };
      document.body.classList.add("dragging");
      event.preventDefault();
    });

    element.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    element.appendChild(handle);
    element.appendChild(remove);
    sliceLayer.appendChild(element);
  });
};

const isInsideImage = (event) => {
  if (!imageMeta) {
    return false;
  }
  const rect = sourceImage.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
};

const updateHoverLine = (event) => {
  if (!isInsideImage(event)) {
    hoverLine.style.top = "-9999px";
    hoverLabel.style.top = "-9999px";
    return;
  }
  const { imageRect } = getImageRects();
  const y = getRelativeY(event);
  const scale = imageMeta.naturalHeight / imageRect.height;
  const naturalY = Math.round(y * scale);
  hoverLine.style.top = `${event.clientY - 0.5}px`;
  hoverLabel.style.top = `${event.clientY}px`;
  hoverLabel.style.left = `${Math.max(imageRect.left, 8)}px`;
  hoverLabel.textContent = `${naturalY}PX`;
};

const handlePointerMove = (event) => {
  if (!imageMeta) {
    return;
  }
  updateHoverLine(event);

  if (dragState) {
    const y = getRelativeY(event);
    slicePoints = slicePoints.map((point) => {
      if (point.id !== dragState.id) {
        return point;
      }
      const { imageRect, offsetY } = getImageRects();
      const scale = imageMeta.naturalHeight / imageRect.height;
      const clampedY = clamp(y, 0, imageRect.height);
      return {
        ...point,
        displayY: clampedY + offsetY,
        naturalY: Math.round(clampedY * scale),
      };
    });
    renderSlicePoints();
  }
};

const handlePointerUp = () => {
  if (dragState) {
    dragState = null;
    document.body.classList.remove("dragging");
  }
};

const loadFile = (file) => {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => showImage(file.name, reader.result);
  reader.readAsDataURL(file);
};

const handleDrop = (event) => {
  event.preventDefault();
  dragCounter = 0;
  setDragActive(false);
  const [file] = event.dataTransfer.files;
  loadFile(file);
};

const downloadSlices = async () => {
  if (!imageMeta) {
    return;
  }
  const image = new Image();
  image.onload = async () => {
    const points = slicePoints
      .map((point) => clamp(point.naturalY, 0, imageMeta.naturalHeight))
      .filter((value) => value > 0 && value < imageMeta.naturalHeight)
      .sort((a, b) => a - b);

    const boundaries = [0, ...points, imageMeta.naturalHeight];
    const files = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const startY = boundaries[index];
      if (index === boundaries.length - 1) {
        continue;
      }
      const endY = boundaries[index + 1];
      const height = endY - startY;
      if (height <= 0) {
        continue;
      }
      const canvas = document.createElement("canvas");
      canvas.width = imageMeta.naturalWidth;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        image,
        0,
        startY,
        imageMeta.naturalWidth,
        height,
        0,
        0,
        imageMeta.naturalWidth,
        height
      );
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) {
        continue;
      }
      const arrayBuffer = await blob.arrayBuffer();
      files.push({
        name: `${imageMeta.baseName}-slice-${index + 1}.png`,
        data: new Uint8Array(arrayBuffer),
      });
    }
    if (!files.length) {
      return;
    }
    const zipBlob = new Blob([buildZip(files)], { type: "application/zip" });
    const link = document.createElement("a");
    link.download = `${imageMeta.baseName}-slices.zip`;
    link.href = URL.createObjectURL(zipBlob);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  image.src = sourceImage.src;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data) => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const encodeUint32 = (value) => {
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >>> 8) & 0xff;
  bytes[2] = (value >>> 16) & 0xff;
  bytes[3] = (value >>> 24) & 0xff;
  return bytes;
};

const encodeUint16 = (value) => {
  const bytes = new Uint8Array(2);
  bytes[0] = value & 0xff;
  bytes[1] = (value >>> 8) & 0xff;
  return bytes;
};

const concatChunks = (chunks) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
};

const buildZip = (files) => {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const localHeader = concatChunks([
      encodeUint32(0x04034b50),
      encodeUint16(20),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint32(crc),
      encodeUint32(size),
      encodeUint32(size),
      encodeUint16(nameBytes.length),
      encodeUint16(0),
      nameBytes,
    ]);

    localChunks.push(localHeader, file.data);

    const centralHeader = concatChunks([
      encodeUint32(0x02014b50),
      encodeUint16(20),
      encodeUint16(20),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint32(crc),
      encodeUint32(size),
      encodeUint32(size),
      encodeUint16(nameBytes.length),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint32(0),
      encodeUint32(offset),
      nameBytes,
    ]);

    centralChunks.push(centralHeader);
    offset += localHeader.length + file.data.length;
  });

  const centralDir = concatChunks(centralChunks);
  const endRecord = concatChunks([
    encodeUint32(0x06054b50),
    encodeUint16(0),
    encodeUint16(0),
    encodeUint16(files.length),
    encodeUint16(files.length),
    encodeUint32(centralDir.length),
    encodeUint32(offset),
    encodeUint16(0),
  ]);

  return concatChunks([...localChunks, centralDir, endRecord]);
};

document.addEventListener("dragover", (event) => {
  event.preventDefault();
});

document.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragCounter += 1;
  if (event.dataTransfer?.types?.includes("Files")) {
    setDragActive(true);
  }
});

document.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) {
    setDragActive(false);
  }
});

document.addEventListener("drop", handleDrop);

hint.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  loadFile(file);
  fileInput.value = "";
});

stage.addEventListener("click", (event) => {
  if (!imageMeta) {
    return;
  }
  if (!isInsideImage(event)) {
    return;
  }
  const y = getRelativeY(event);
  addSlicePoint(y);
});

document.addEventListener("pointermove", handlePointerMove);
document.addEventListener("pointerup", handlePointerUp);
window.addEventListener("resize", syncSlicePointsToImage);

sliceButton.addEventListener("click", downloadSlices);
