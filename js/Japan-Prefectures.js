var svg;
var regions;
var data;

var COOLDOWN_TURNS = 0;
const cooldowns = {};

let guessing = false;
let romaji = false;
let currentTarget = null;

var camera;
var target;
var viewBox;

var baseWidth;
var baseHeight;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 35;

var isPanning = false;
var startMouse = {x: 0, y: 0};
var startViewBox = {x: 0, y: 0};

async function loadSVG() {
try {
    const response = await fetch("SVG/Japan-Prefectures.svg");
    const svgText = await response.text();
    
    const map = document.getElementById("map");
    map.innerHTML = svgText;

    svg = map.querySelector("svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    viewBox = svg.viewBox.baseVal;
    baseWidth = viewBox.width;
    baseHeight = viewBox.height;

    regions = [...svg.querySelectorAll("path[id]")];

    COOLDOWN_TURNS = Math.round(regions.length * 0.75);

    addSvgEventListeners();
    loadData();

} catch (error) {
    console.error('Error reading file:', error);
}}

async function loadData() {
try {
    const response = await fetch("Json/data-prefectures.csv");

    const csvData = await response.text();
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

    initializeCamera();
    loadQuestion();
    animate();

} catch (error) {
    console.error('Error reading file:', error);
}}

function updateCooldowns() {
    for (const id in cooldowns) {
        cooldowns[id]--;
        if (cooldowns[id] <= 0) delete cooldowns[id];
    }
}

function loadQuestion() {
    updateCooldowns();

    const available = regions.filter(r => !cooldowns[r.id]);
    const pool = available.length ? available : regions;

    currentTarget = pool[Math.floor(Math.random() * pool.length)];

    cooldowns[currentTarget.id] = COOLDOWN_TURNS;

    const name = data[currentTarget.id]["full-ja"];

    document.getElementById("questionText").textContent = name;

    guessing = true;

    regions.forEach(region => {
        region.classList.add("guessing");
    });
}

function reveal(region) {
    guessing = false;

    regions.forEach(region => {
        region.classList.remove("guessing");
    });

    if (region === currentTarget) {
        region.classList.add("correct");
    } else {
        region.classList.add("wrong");
        currentTarget.classList.add("correct");
    }

    document.getElementById("legendBox").classList.add("show");
    document.getElementById("continueButton").classList.add("show");
}

function resetAndContinue() {
    if (guessing) return;

    regions.forEach(region => {
        region.classList.remove("correct");
        region.classList.remove("wrong");
    });

    document.getElementById("legendBox").classList.remove("show");
    document.getElementById("continueButton").classList.remove("show");

    loadQuestion();
}

document.addEventListener("keydown", (e) => {
    if (guessing) return;

    if (e.code === "Space" || e.code === "Enter") {
        resetAndContinue();
    }
});

window.buttonContinue = function () {
    if (guessing) return;
    resetAndContinue();
}

function initializeCamera() {
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
    
    animate();
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
    } 
    else {
        renderedHeight = rect.width / viewAspect;
        offsetY = (rect.height - renderedHeight) / 2;
    }

    return {
        x: (e.clientX - rect.left - offsetX) / renderedWidth,
        y: (e.clientY - rect.top - offsetY) / renderedHeight
    };

}

window.addEventListener("mouseup", () => {
    isPanning = false;
    svg.style.cursor = "grab";
});

window.addEventListener("mousemove", e => {
    if (!isPanning) return;

    const mouse = getSvgMousePosition(e);

    const dx = (mouse.x - startMouse.x) * target.width;
    const dy = (mouse.y - startMouse.y) * target.height;

    target.x = startViewBox.x - dx;
    target.y = startViewBox.y - dy;
});

function addSvgEventListeners() {

    svg.addEventListener("click", e => {
        if (!guessing) return;
        if (!e.target.matches(".guessing")) return;
        e.stopPropagation();
        reveal(e.target);
    });

    svg.addEventListener("mousedown", e => {
        isPanning = true;

        const mouse = getSvgMousePosition(e);

        startMouse.x = mouse.x;
        startMouse.y = mouse.y;

        startViewBox.x = viewBox.x;
        startViewBox.y = viewBox.y;

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

    }, { passive:false });

}

loadSVG();