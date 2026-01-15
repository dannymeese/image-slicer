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
const orientationToggle = document.getElementById("orientationToggle");
const toggleButtons = orientationToggle.querySelectorAll(".toggle-btn");

let imageMeta = null;
let sliceLines = {
  horizontal: [],
  vertical: [],
};
let dragState = null;
let dragCounter = 0;
let activeOrientation = "horizontal";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const resetState = () => {
  sliceLines = {
    horizontal: [],
    vertical: [],
  };
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
      scaleX: sourceImage.naturalWidth / displayWidth,
      scaleY: sourceImage.naturalHeight / displayHeight,
    };
    hoverLine.style.display = "none";
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
    offsetX: imageRect.left - wrapRect.left,
  };
};

const syncSlicePointsToImage = () => {
  if (!imageMeta) {
    return;
  }
  const { imageRect } = getImageRects();
  if (!imageRect.height) {
    return;
  }
  const scaleY = imageMeta.naturalHeight / imageRect.height;
  const scaleX = imageMeta.naturalWidth / imageRect.width;
  imageMeta.displayWidth = imageRect.width;
  imageMeta.displayHeight = imageRect.height;
  imageMeta.scaleX = scaleX;
  imageMeta.scaleY = scaleY;
  renderSliceLines();
};

const getScales = () => {
  const { imageRect } = getImageRects();
  return {
    scaleX: imageMeta.naturalWidth / imageRect.width,
    scaleY: imageMeta.naturalHeight / imageRect.height,
  };
};

const getBounds = (positions, value, min, max) => {
  const sorted = positions.slice().sort((a, b) => a - b);
  let left = min;
  let right = max;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] < value) {
      left = sorted[i];
    } else {
      right = sorted[i];
      break;
    }
  }
  return { left, right };
};

const getScreenBounds = (positions, value, toDisplay, minScreen, maxScreen) => {
  const sorted = positions.slice().sort((a, b) => a - b);
  let left = null;
  let right = null;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] < value) {
      left = sorted[i];
    } else {
      right = sorted[i];
      break;
    }
  }
  return {
    left: left === null ? minScreen : toDisplay(left),
    right: right === null ? maxScreen : toDisplay(right),
  };
};

const addSliceLine = (orientation, naturalPos, anchorCross) => {
  const verticalPositions = sliceLines.vertical.map((line) => line.naturalPos);
  const horizontalPositions = sliceLines.horizontal.map(
    (line) => line.naturalPos
  );
  let minCross = 0;
  let maxCross = 0;
  if (orientation === "horizontal") {
    const bounds = getBounds(
      verticalPositions,
      anchorCross,
      0,
      imageMeta.naturalWidth
    );
    minCross = bounds.left;
    maxCross = bounds.right;
  } else {
    const bounds = getBounds(
      horizontalPositions,
      anchorCross,
      0,
      imageMeta.naturalHeight
    );
    minCross = bounds.left;
    maxCross = bounds.right;
  }
  const line = {
    id: crypto.randomUUID(),
    orientation,
    naturalPos,
    anchorCross,
    minCross,
    maxCross,
  };
  sliceLines[orientation].push(line);
  renderSliceLines();
};

const renderSliceLines = () => {
  sliceLayer.innerHTML = "";
  if (!imageMeta) {
    return;
  }
  const { imageRect, offsetX, offsetY } = getImageRects();
  if (!imageRect.width || !imageRect.height) {
    return;
  }
  const { scaleX, scaleY } = getScales();
  const renderLine = (line) => {
    const element = document.createElement("div");
    element.className = `slice-point ${line.orientation}`;
    element.dataset.id = line.id;
    element.dataset.orientation = line.orientation;

    const handle = document.createElement("div");
    handle.className = `move-handle ${line.orientation}`;
    handle.textContent = "↔";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "×";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      sliceLines[line.orientation] = sliceLines[line.orientation].filter(
        (item) => item.id !== line.id
      );
      renderSliceLines();
    });

    element.addEventListener("pointerdown", (event) => {
      if (event.target === remove) {
        return;
      }
      dragState = {
        id: line.id,
        orientation: line.orientation,
      };
      document.body.classList.add("dragging");
      event.preventDefault();
    });

    element.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    element.appendChild(handle);
    element.appendChild(remove);

    if (line.orientation === "horizontal") {
      const leftDisplay = line.minCross / scaleX + offsetX;
      const rightDisplay = line.maxCross / scaleX + offsetX;
      const yDisplay = line.naturalPos / scaleY + offsetY;
      element.style.top = `${yDisplay}px`;
      element.style.left = `${leftDisplay - 20}px`;
      element.style.width = `${rightDisplay - leftDisplay + 40}px`;
    } else {
      const topDisplay = line.minCross / scaleY + offsetY;
      const bottomDisplay = line.maxCross / scaleY + offsetY;
      const xDisplay = line.naturalPos / scaleX + offsetX;
      element.style.left = `${xDisplay}px`;
      element.style.top = `${topDisplay - 20}px`;
      element.style.height = `${bottomDisplay - topDisplay + 40}px`;
      element.style.width = "1px";
      element.style.transform = "translateX(-0.5px)";
    }
    sliceLayer.appendChild(element);
  };

  sliceLines.horizontal.forEach(renderLine);
  sliceLines.vertical.forEach(renderLine);
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
    hoverLine.style.display = "none";
    hoverLabel.style.top = "-9999px";
    return;
  }
  const { imageRect, offsetX, offsetY } = getImageRects();
  const { scaleX, scaleY } = getScales();
  const relX = clamp(event.clientX - imageRect.left, 0, imageRect.width);
  const relY = clamp(event.clientY - imageRect.top, 0, imageRect.height);
  const naturalX = clamp(Math.round(relX * scaleX), 0, imageMeta.naturalWidth);
  const naturalY = clamp(
    Math.round(relY * scaleY),
    0,
    imageMeta.naturalHeight
  );
  const verticalPositions = sliceLines.vertical.map((line) => line.naturalPos);
  const horizontalPositions = sliceLines.horizontal.map(
    (line) => line.naturalPos
  );

  hoverLine.style.display = "block";
  hoverLine.className = `hover-line ${activeOrientation}`;

  if (activeOrientation === "horizontal") {
    const bounds = getScreenBounds(
      verticalPositions,
      naturalX,
      (value) => imageRect.left + value / scaleX,
      0,
      window.innerWidth
    );
    hoverLine.style.top = `${event.clientY - 0.5}px`;
    hoverLine.style.left = `${bounds.left}px`;
    hoverLine.style.width = `${bounds.right - bounds.left}px`;
    hoverLine.style.height = "1px";
    hoverLabel.textContent = `${naturalY}PX`;
  } else {
    const bounds = getScreenBounds(
      horizontalPositions,
      naturalY,
      (value) => imageRect.top + value / scaleY,
      0,
      window.innerHeight
    );
    hoverLine.style.left = `${event.clientX - 0.5}px`;
    hoverLine.style.top = `${bounds.left}px`;
    hoverLine.style.height = `${bounds.right - bounds.left}px`;
    hoverLine.style.width = "1px";
    hoverLabel.textContent = `${naturalX}PX`;
  }

  hoverLabel.style.top = `${event.clientY}px`;
  hoverLabel.style.left = `${Math.max(imageRect.left, 8)}px`;
};

const handlePointerMove = (event) => {
  if (!imageMeta) {
    return;
  }
  updateHoverLine(event);

  if (dragState) {
    const { imageRect } = getImageRects();
    const { scaleX, scaleY } = getScales();
    const relX = clamp(event.clientX - imageRect.left, 0, imageRect.width);
    const relY = clamp(event.clientY - imageRect.top, 0, imageRect.height);
    if (dragState.orientation === "horizontal") {
      const naturalY = clamp(
        Math.round(relY * scaleY),
        0,
        imageMeta.naturalHeight
      );
      sliceLines.horizontal = sliceLines.horizontal.map((line) => {
        if (line.id !== dragState.id) {
          return line;
        }
        return {
          ...line,
          naturalPos: naturalY,
        };
      });
    } else {
      const naturalX = clamp(
        Math.round(relX * scaleX),
        0,
        imageMeta.naturalWidth
      );
      sliceLines.vertical = sliceLines.vertical.map((line) => {
        if (line.id !== dragState.id) {
          return line;
        }
        return {
          ...line,
          naturalPos: naturalX,
        };
      });
    }
    renderSliceLines();
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
    const positions =
      activeOrientation === "horizontal"
        ? sliceLines.horizontal.map((line) => line.naturalPos)
        : sliceLines.vertical.map((line) => line.naturalPos);
    const clamped = positions
      .map((value) =>
        activeOrientation === "horizontal"
          ? clamp(value, 0, imageMeta.naturalHeight)
          : clamp(value, 0, imageMeta.naturalWidth)
      )
      .filter((value) =>
        activeOrientation === "horizontal"
          ? value > 0 && value < imageMeta.naturalHeight
          : value > 0 && value < imageMeta.naturalWidth
      )
      .sort((a, b) => a - b);

    const boundaries =
      activeOrientation === "horizontal"
        ? [0, ...clamped, imageMeta.naturalHeight]
        : [0, ...clamped, imageMeta.naturalWidth];
    const files = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const startY = boundaries[index];
      if (index === boundaries.length - 1) {
        continue;
      }
      const endY = boundaries[index + 1];
      const span = endY - startY;
      if (span <= 0) {
        continue;
      }
      const canvas = document.createElement("canvas");
      if (activeOrientation === "horizontal") {
        canvas.width = imageMeta.naturalWidth;
        canvas.height = span;
      } else {
        canvas.width = span;
        canvas.height = imageMeta.naturalHeight;
      }
      const ctx = canvas.getContext("2d");
      if (activeOrientation === "horizontal") {
        ctx.drawImage(
          image,
          0,
          startY,
          imageMeta.naturalWidth,
          span,
          0,
          0,
          imageMeta.naturalWidth,
          span
        );
      } else {
        ctx.drawImage(
          image,
          startY,
          0,
          span,
          imageMeta.naturalHeight,
          0,
          0,
          span,
          imageMeta.naturalHeight
        );
      }
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) {
        continue;
      }
      const arrayBuffer = await blob.arrayBuffer();
      const suffix =
        activeOrientation === "horizontal" ? "row" : "col";
      files.push({
        name: `${imageMeta.baseName}-${suffix}-${index + 1}.png`,
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
  const { imageRect } = getImageRects();
  const { scaleX, scaleY } = getScales();
  const relX = clamp(event.clientX - imageRect.left, 0, imageRect.width);
  const relY = clamp(event.clientY - imageRect.top, 0, imageRect.height);
  const naturalX = clamp(Math.round(relX * scaleX), 0, imageMeta.naturalWidth);
  const naturalY = clamp(
    Math.round(relY * scaleY),
    0,
    imageMeta.naturalHeight
  );
  if (activeOrientation === "horizontal") {
    addSliceLine("horizontal", naturalY, naturalX);
  } else {
    addSliceLine("vertical", naturalX, naturalY);
  }
});

document.addEventListener("pointermove", handlePointerMove);
document.addEventListener("pointerup", handlePointerUp);
window.addEventListener("resize", syncSlicePointsToImage);

sliceButton.addEventListener("click", downloadSlices);

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const orientation = button.dataset.orientation;
    if (orientation === activeOrientation) {
      return;
    }
    activeOrientation = orientation;
    toggleButtons.forEach((item) => {
      const isActive = item.dataset.orientation === activeOrientation;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
    hoverLine.style.display = "none";
  });
});
