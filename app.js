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

const getNearestLineIds = (lines, value) => {
  const sorted = lines.slice().sort((a, b) => a.naturalPos - b.naturalPos);
  let leftId = null;
  let rightId = null;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].naturalPos < value) {
      leftId = sorted[i].id;
    } else {
      rightId = sorted[i].id;
      break;
    }
  }
  return { leftId, rightId };
};

const getBoundPosition = (id, lines, fallback) => {
  const match = lines.find((line) => line.id === id);
  return match ? match.naturalPos : fallback;
};

const getLineSpan = (line) => {
  if (line.orientation === "horizontal") {
    const leftBound = getBoundPosition(line.leftId, sliceLines.vertical, 0);
    const rightBound = getBoundPosition(
      line.rightId,
      sliceLines.vertical,
      imageMeta.naturalWidth
    );
    return { min: leftBound, max: rightBound };
  }
  const topBound = getBoundPosition(line.leftId, sliceLines.horizontal, 0);
  const bottomBound = getBoundPosition(
    line.rightId,
    sliceLines.horizontal,
    imageMeta.naturalHeight
  );
  return { min: topBound, max: bottomBound };
};

const getPerpendicularLinesAtCross = (orientation, crossPos) => {
  const perpendicular =
    orientation === "horizontal" ? sliceLines.vertical : sliceLines.horizontal;
  return perpendicular.filter((line) => {
    const span = getLineSpan(line);
    return crossPos >= span.min && crossPos <= span.max;
  });
};

const addSliceLine = (orientation, naturalPos, anchorCross) => {
  const perpendicular = getPerpendicularLinesAtCross(
    orientation,
    naturalPos
  );
  const { leftId, rightId } = getNearestLineIds(perpendicular, anchorCross);
  const line = {
    id: crypto.randomUUID(),
    orientation,
    naturalPos,
    anchorCross,
    leftId,
    rightId,
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
    const handleIcon = document.createElement("span");
    handleIcon.className = "move-icon";
    handleIcon.textContent = "↔";
    handle.appendChild(handleIcon);

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
      const leftBound = getBoundPosition(
        line.leftId,
        sliceLines.vertical,
        0
      );
      const rightBound = getBoundPosition(
        line.rightId,
        sliceLines.vertical,
        imageMeta.naturalWidth
      );
      const leftDisplay = leftBound / scaleX + offsetX;
      const rightDisplay = rightBound / scaleX + offsetX;
      const yDisplay = line.naturalPos / scaleY + offsetY;
      element.style.top = `${yDisplay}px`;
      element.style.left = `${leftDisplay}px`;
      element.style.width = `${rightDisplay - leftDisplay}px`;
    } else {
      const topBound = getBoundPosition(
        line.leftId,
        sliceLines.horizontal,
        0
      );
      const bottomBound = getBoundPosition(
        line.rightId,
        sliceLines.horizontal,
        imageMeta.naturalHeight
      );
      const topDisplay = topBound / scaleY + offsetY;
      const bottomDisplay = bottomBound / scaleY + offsetY;
      const xDisplay = line.naturalPos / scaleX + offsetX;
      element.style.left = `${xDisplay}px`;
      element.style.top = `${topDisplay}px`;
      element.style.height = `${bottomDisplay - topDisplay}px`;
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
  hoverLine.style.display = "block";
  hoverLine.className = `hover-line ${activeOrientation}`;

  if (activeOrientation === "horizontal") {
    const eligibleVerticals = getPerpendicularLinesAtCross(
      "horizontal",
      naturalY
    );
    const verticalPositions = eligibleVerticals.map((line) => line.naturalPos);
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
    const eligibleHorizontals = getPerpendicularLinesAtCross(
      "vertical",
      naturalX
    );
    const horizontalPositions = eligibleHorizontals.map(
      (line) => line.naturalPos
    );
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
    const verticalLines = sliceLines.vertical;
    const horizontalLines = sliceLines.horizontal;
    const xCoords = [
      0,
      imageMeta.naturalWidth,
      ...verticalLines.map((line) => line.naturalPos),
    ];
    const yCoords = [
      0,
      imageMeta.naturalHeight,
      ...horizontalLines.map((line) => line.naturalPos),
    ];
    const uniqueSorted = (values) =>
      Array.from(new Set(values)).sort((a, b) => a - b);
    const xs = uniqueSorted(xCoords);
    const ys = uniqueSorted(yCoords);

    const horizontalMap = new Map();
    horizontalLines.forEach((line) => {
      const xMin = getBoundPosition(line.leftId, verticalLines, 0);
      const xMax = getBoundPosition(
        line.rightId,
        verticalLines,
        imageMeta.naturalWidth
      );
      const entry = horizontalMap.get(line.naturalPos) || [];
      entry.push({ min: xMin, max: xMax });
      horizontalMap.set(line.naturalPos, entry);
    });

    const verticalMap = new Map();
    verticalLines.forEach((line) => {
      const yMin = getBoundPosition(line.leftId, horizontalLines, 0);
      const yMax = getBoundPosition(
        line.rightId,
        horizontalLines,
        imageMeta.naturalHeight
      );
      const entry = verticalMap.get(line.naturalPos) || [];
      entry.push({ min: yMin, max: yMax });
      verticalMap.set(line.naturalPos, entry);
    });

    const isBlockedHoriz = (y, xStart, xEnd) => {
      const segments = horizontalMap.get(y);
      if (!segments) {
        return false;
      }
      return segments.some((segment) => segment.min <= xStart && segment.max >= xEnd);
    };

    const isBlockedVert = (x, yStart, yEnd) => {
      const segments = verticalMap.get(x);
      if (!segments) {
        return false;
      }
      return segments.some((segment) => segment.min <= yStart && segment.max >= yEnd);
    };

    const cellWidth = xs.length - 1;
    const cellHeight = ys.length - 1;
    const visited = new Array(cellWidth * cellHeight).fill(false);
    const cells = [];

    const cellIndex = (i, j) => j * cellWidth + i;

    for (let j = 0; j < cellHeight; j += 1) {
      for (let i = 0; i < cellWidth; i += 1) {
        if (visited[cellIndex(i, j)]) {
          continue;
        }
        const queue = [{ i, j }];
        const component = [];
        visited[cellIndex(i, j)] = true;
        while (queue.length) {
          const current = queue.shift();
          component.push(current);
          const xStart = xs[current.i];
          const xEnd = xs[current.i + 1];
          const yStart = ys[current.j];
          const yEnd = ys[current.j + 1];

          if (
            current.i > 0 &&
            !isBlockedVert(xs[current.i], yStart, yEnd) &&
            !visited[cellIndex(current.i - 1, current.j)]
          ) {
            visited[cellIndex(current.i - 1, current.j)] = true;
            queue.push({ i: current.i - 1, j: current.j });
          }
          if (
            current.i < cellWidth - 1 &&
            !isBlockedVert(xs[current.i + 1], yStart, yEnd) &&
            !visited[cellIndex(current.i + 1, current.j)]
          ) {
            visited[cellIndex(current.i + 1, current.j)] = true;
            queue.push({ i: current.i + 1, j: current.j });
          }
          if (
            current.j > 0 &&
            !isBlockedHoriz(ys[current.j], xStart, xEnd) &&
            !visited[cellIndex(current.i, current.j - 1)]
          ) {
            visited[cellIndex(current.i, current.j - 1)] = true;
            queue.push({ i: current.i, j: current.j - 1 });
          }
          if (
            current.j < cellHeight - 1 &&
            !isBlockedHoriz(ys[current.j + 1], xStart, xEnd) &&
            !visited[cellIndex(current.i, current.j + 1)]
          ) {
            visited[cellIndex(current.i, current.j + 1)] = true;
            queue.push({ i: current.i, j: current.j + 1 });
          }
        }

        let minI = Infinity;
        let maxI = -Infinity;
        let minJ = Infinity;
        let maxJ = -Infinity;
        component.forEach((cell) => {
          minI = Math.min(minI, cell.i);
          maxI = Math.max(maxI, cell.i);
          minJ = Math.min(minJ, cell.j);
          maxJ = Math.max(maxJ, cell.j);
        });
        const expectedCount = (maxI - minI + 1) * (maxJ - minJ + 1);
        if (expectedCount === component.length) {
          cells.push({
            x: xs[minI],
            y: ys[minJ],
            width: xs[maxI + 1] - xs[minI],
            height: ys[maxJ + 1] - ys[minJ],
          });
        } else {
          component.forEach((cell) => {
            cells.push({
              x: xs[cell.i],
              y: ys[cell.j],
              width: xs[cell.i + 1] - xs[cell.i],
              height: ys[cell.j + 1] - ys[cell.j],
            });
          });
        }
      }
    }

    const files = [];
    for (let index = 0; index < cells.length; index += 1) {
      const { x, y, width, height } = cells[index];
      if (width <= 0 || height <= 0) {
        continue;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
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
