var svg;
var regions;
var data;

let municipalities = new Set();
let colorPaths = new Set();
let borderPaths = new Set();
const marked = new Set();

const specialColors = {
    3: "hsl(0 0% 60%)",
    4: "hsl(210 23% 20%)",
    6: "hsl(240 23% 20%)",
};

const hues = {
    1: "150",
    2: "180",
    4: "210",
    5: "240",
    7: "270",
    8: "300",
    9: "330"
};

const labelLayer = document.getElementById("labelLayer");
const labelsNormalContainer = document.getElementById("labelsNormal");
const labelsSmallContainer = document.getElementById("labelsSmall");

const normalLabels = [];
const smallLabels = [];

var camera;
var target;
var viewBox;

var baseWidth;
var baseHeight;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 50;

let isPanning = false;
let mouseHasMoved = false;
let startMouse = { x: 0, y: 0 };
let startViewBox = { x: 0, y: 0 };

let zoomLevel = 0;

async function loadData() {
try {
    const [svgResponse, csvResponse, jsonResponse] = await Promise.all([
        fetch("SVG/Japan-Phone-Codes.svg"),
        fetch("Json/data.csv"),
        fetch("Json/Japan-Phone-Code-Labels-Alt.json")
    ]);
    const svgText = await svgResponse.text();
    
    const map = document.getElementById("map");
    map.innerHTML = svgText;

    svg = map.querySelector("svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    viewBox = svg.viewBox.baseVal;
    baseWidth = viewBox.width;
    baseHeight = viewBox.height;

    regions = [...svg.querySelectorAll("path[id]")];
    
    addSvgEventListeners();
    setPathClasses();
    initializeZoom();
    animate();
    

    const csvData = await csvResponse.text();
    const lines = csvData
        .replace(/\r\n/g, "\n")
        .trim()
        .split("\n");
    const headers = lines[0].split(",");

    data = lines.slice(1).reduce((obj, line) => {
        const values = line.split(",");

        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index];
        });

        obj[row.code] = row;

        return obj;
    }, {});

    const labelData = await jsonResponse.json();

    const reordered = {
        text: labelData.text,
        x: labelData.x,
        y: labelData.y,
        type: labelData.type
    };

    for (const l of labelData) {
        const div = document.createElement("div");

        div.textContent = l.text;
        div.className = "label";

        if (l.type === "small" || l.type === "medium") {
            div.classList.add("small");
            labelsSmallContainer.appendChild(div);
            smallLabels.push({ el: div, ...l });
        } else {
            div.classList.add("normal");
            labelsNormalContainer.appendChild(div);
            normalLabels.push({ el: div, ...l });
        }
    }

} catch (error) {
    console.error('Error reading file:', error);
}}

function setPathClasses() {
    regions.forEach(region => {
        if (!region.id) return;
        
        if (!(region.id[0] == 9 && region.id[1] == 8) && !(region.id[0] == 9 && region.id[1] == 9) && !(region.id[0] == 9 && region.id[1] == 6) ) {
            municipalities.add(region.id);
            region.classList.add("interactivePath");
        }

        if (region.id[0] == 9 && region.id[1] == 8) {
            borderPaths.add(region.id);
            region.classList.add("borderPath");
        }

        if (region.id[0] == 9 && region.id[1] == 9) {
            colorPaths.add(region.id);
            region.classList.add("colorPath");
        }

    });
    fillPaths();
}

function fillPaths() {
    colorPaths.forEach(region => {
        const id = Number(region.slice(2));
        const path = document.getElementById(region);

        if (specialColors[id]) {
            path.style.fill = specialColors[id];
            path.style.stroke = specialColors[id];
            return;
        }

        const normalized = String(id).padEnd(3, "0");
        const hue = hues[Number(normalized[0])];
        const shade = Number(normalized.slice(1, 3));

        const lightness = 20 + shade * (60 / 99);

        path.style.fill = `hsl(${hue} 23% ${lightness}%)`;
        path.style.stroke = `hsl(${hue} 23% ${lightness}%)`;
    });
}

function mark(region) {
    if (marked.has(region.id)) {
        marked.delete(region.id);
        region.classList.remove("selected");
    } else {
        marked.forEach(selected => {
            document.getElementById(selected).classList.remove("selected");
            marked.delete(selected);
        })
        marked.add(region.id);
        region.classList.add("selected");
    }

    if (marked.size != 0) {
        document.getElementById("infoBox").classList.add("show");
    }
    else {
        document.getElementById("infoBox").classList.remove("show");
    }

    document.getElementById("Kanji").textContent = data[region.id]["full-ja"];
    document.getElementById("Romaji").textContent = data[region.id]["base-en"];
    document.getElementById("PhoneCode").textContent = "0" + data[region.id].phone;
}

function toggleLabels(scale) {

    let newLevel;

    if (scale < 2.5) {
        newLevel = 0;
    } else if (scale < 6) {
        newLevel = 1;
    } else {
        newLevel = 2;
    }

    if (newLevel === zoomLevel) return;
    
    switch (newLevel) {
        case 0:
            setZoomFar();
            break;

        case 1:
            setZoomNormal();
            break;

        case 2:
            setZoomClose();
            break;
    }
    zoomLevel = newLevel;
}

function initializeZoom() {
    camera = {
        x: viewBox.x,
        y: viewBox.y,
        width: viewBox.width,
        height: viewBox.height
    };

    target = { ...camera };

    viewBox = svg.viewBox.baseVal;

    baseWidth = viewBox.width;
    baseHeight = viewBox.height;

    document.getElementById("labelsSmall").classList.add("hideLabel");
    document.getElementById("labelsNormal").classList.remove("hideLabel");

    municipalities.forEach(municipality => {
        document.getElementById(municipality).classList.add("hideBorder");
    })

    colorPaths.forEach(border => {
        document.getElementById(border).classList.add("hideBorder");
    })
};

function setZoomFar() {
    document.getElementById("labelsSmall").classList.add("hideLabel");
    document.getElementById("labelsNormal").classList.remove("hideLabel");

    colorPaths.forEach(border => {
        document.getElementById(border).classList.add("hideBorder");
    })

    borderPaths.forEach(border => {
        document.getElementById(border).classList.remove("hideBorder");
    })

    municipalities.forEach(municipality => {
        document.getElementById(municipality).classList.add("hideBorder");
    })

    municipalities.forEach(municipality => {
        document.getElementById(municipality).classList.remove("showLess");
    })
};

function setZoomNormal() {
    document.getElementById("labelsSmall").classList.remove("hideLabel");
    document.getElementById("labelsNormal").classList.add("hideLabel");

    municipalities.forEach(municipality => {
        document.getElementById(municipality).classList.add("showLess");
    })

    municipalities.forEach(municipality => {
        document.getElementById(municipality).classList.remove("hideBorder");
    })

    colorPaths.forEach(colorPath => {
        document.getElementById(colorPath).classList.remove("hideBorder");
    })

    borderPaths.forEach(border => {
        document.getElementById(border).classList.add("hideBorder");
    })
};

function setZoomClose() {
    municipalities.forEach(municipality => {
        document.getElementById(municipality).classList.remove("showLess");
    })
};

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function updateViewBox() {
    svg.setAttribute(
        "viewBox",
        `${camera.x} ${camera.y} ${camera.width} ${camera.height}`
    );
}

function animate() {
    const smoothness = 0.3;

    camera.x = lerp(camera.x, target.x, smoothness);
    camera.y = lerp(camera.y, target.y, smoothness);
    camera.width = lerp(camera.width, target.width, smoothness);
    camera.height = lerp(camera.height, target.height, smoothness);

    updateViewBox();
    requestAnimationFrame(animate);
    updateLabelPositions();
}

function getSvgMousePosition(e) {

    const rect = svg.getBoundingClientRect();
    const viewAspect = viewBox.width / viewBox.height;
    const rectAspect = rect.width / rect.height;

    let renderedWidth = rect.width;
    let renderedHeight = rect.height;

    let offsetX = 0;
    let offsetY = 0;

    if (rectAspect > viewAspect) {
        renderedWidth = rect.height * viewAspect;
        offsetX = (rect.width - renderedWidth) / 2;
    } else {
        renderedHeight = rect.width / viewAspect;
        offsetY = (rect.height - renderedHeight) / 2;
    }

    return {
        x: (e.clientX - rect.left - offsetX) / renderedWidth,
        y: (e.clientY - rect.top - offsetY) / renderedHeight
    };
}

function updateLabelPositions() {

    const rect = svg.getBoundingClientRect();

    const viewAspect = camera.width / camera.height;
    const rectAspect = rect.width / rect.height;

    let renderedWidth = rect.width;
    let renderedHeight = rect.height;

    let offsetX = 0;
    let offsetY = 0;

    if (rectAspect > viewAspect) {
        renderedWidth = rect.height * viewAspect;
        offsetX = (rect.width - renderedWidth) / 2;
    } else {
        renderedHeight = rect.width / viewAspect;
        offsetY = (rect.height - renderedHeight) / 2;
    }

    const scaleX = renderedWidth / camera.width;
    const scaleY = renderedHeight / camera.height;

    updateGroup(normalLabels, scaleX, scaleY, offsetX, offsetY);
    updateGroup(smallLabels, scaleX, scaleY, offsetX, offsetY);
}

function updateGroup(list, scaleX, scaleY, offsetX, offsetY) {
    for (const l of list) {
        const x = (l.x - camera.x) * scaleX + offsetX;
        const y = (l.y - camera.y) * scaleY + offsetY;

        l.el.style.transform =
            `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
}

window.addEventListener("mouseup", () => {
    isPanning = false;
    svg.style.cursor = "grab";
});

window.addEventListener("mousemove", e => {
    if (!isPanning) return;
    mouseHasMoved = true;

    const mouse = getSvgMousePosition(e);

    const dx = (mouse.x - startMouse.x) * target.width;
    const dy = (mouse.y - startMouse.y) * target.height;

    target.x = startViewBox.x - dx;
    target.y = startViewBox.y - dy;
});

function addSvgEventListeners() {
    svg.addEventListener("click", e => {
        if (mouseHasMoved) {
            mouseHasMoved = false;
            return;
        }
        if (!e.target.matches(".interactivePath")) return;
        e.stopPropagation();
        mark(e.target);
    });

    svg.addEventListener("mousedown", e => {
        isPanning = true;
        mouseHasMoved = false;

        const mouse = getSvgMousePosition(e);

        startMouse.x = mouse.x;
        startMouse.y = mouse.y;

        startViewBox.x = target.x;
        startViewBox.y = target.y;

        svg.style.cursor = "grabbing";
        e.preventDefault();
    });
    
    svg.addEventListener("wheel", e => {
        e.preventDefault();

        const zoomFactor = 1.1;
        const mouse = getSvgMousePosition(e);

        const scale = baseWidth / target.width;

        let newScale = scale * (e.deltaY < 0 ? zoomFactor : 1 / zoomFactor);
        newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

        const newWidth = baseWidth / newScale;
        const newHeight = baseHeight / newScale;

        target.x = mouse.x * (target.width - newWidth) + target.x;
        target.y = mouse.y * (target.height - newHeight) + target.y;

        target.width = newWidth;
        target.height = newHeight;

        toggleLabels(newScale);

    }, { passive: false });
}

loadData();