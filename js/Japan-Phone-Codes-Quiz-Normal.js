var svg;
var regions;

var COOLDOWN_TURNS = 0;
const cooldowns = {};

const slider1 = document.getElementById("slider1");
const slider2 = document.getElementById("slider2");
const range = document.querySelector(".sliderRange");
const rangeText = document.getElementById("rangeText");

slider1.addEventListener("input", updateSlider);
slider2.addEventListener("input", updateSlider);

var filterMin = 0;
var filterMax = 99;

const sliderIndex = [
    11, 12, 13, 14, 15, 16, 17, 18, 19,
    22, 23, 24, 25, 26, 27, 28, 29, 3,
    4, 42, 43, 44, 45, 46, 47, 48, 49,
    52, 53, 54, 55, 56, 57, 58, 59, 6,
    72, 73, 74, 75, 76, 77, 78, 79,
    82, 83, 84, 85, 86, 87, 88, 89,
    92, 93, 94, 95, 96, 97, 98, 99
];

let guessing = false;
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
    const response = await fetch("SVG/Japan-Phone-Codes-Normal.svg");
    const svgText = await response.text();
    
    const map = document.getElementById("map");
    map.innerHTML = svgText;

    svg = map.querySelector("svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    viewBox = svg.viewBox.baseVal;
    baseWidth = viewBox.width;
    baseHeight = viewBox.height;

    regions = [...svg.querySelectorAll("path[id]")];

    COOLDOWN_TURNS = Math.round(regions.filter(region => (region.id[0] == 9 && region.id[1] == 9)) / 2);

    addSvgEventListeners();
    sortPaths();
    updateSlider();
    initializeCamera();
    loadQuestion();
    animate();

} catch (error) {
    console.log('Error reading file:', error);
}}

function updateCooldowns() {
    for (const id in cooldowns) {
        cooldowns[id]--;
        if (cooldowns[id] <= 0) delete cooldowns[id];
    }
}

function sortPaths() {
    regions.forEach(region => {
        if(!(region.id[0] == 9 && region.id[1] == 9)) {
            region.classList.add("prefecturePath");
        }
    });
}

function loadQuestion() {
    updateCooldowns();

    const available = regions.filter(region => !cooldowns[region.id] && (region.id[0] == 9 && region.id[1] == 9));
    const availableFiltered = available.filter(region => Number(String(Number(String(region.id).slice(2))).padEnd(4, "0")) >= filterMin && Number(String(Number(String(region.id).slice(2))).padEnd(4, "0")) <= filterMax);
    const pool = availableFiltered.length ? availableFiltered : regions;

    currentTarget = pool[Math.floor(Math.random() * pool.length)];

    cooldowns[currentTarget.id] = COOLDOWN_TURNS;

    const name = Number(String(currentTarget.id).slice(2));

    document.getElementById("questionText").textContent = "0" + name;

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

function updateSlider() {
    const min = Math.min(Number(slider1.value), Number(slider2.value));
    const max = Math.max(Number(slider1.value), Number(slider2.value));

    setSliderText(sliderIndex[min], sliderIndex[max]);

    filterMin = Number(String(sliderIndex[min]).padEnd(4, "0"));
    filterMax = Number(String(sliderIndex[max]).padEnd(4, "0")) + 99;

    Object.keys(cooldowns).forEach(k => delete cooldowns[k]);

    COOLDOWN_TURNS = Math.round(regions.filter(region => Number(String(Number(String(region.id).slice(2))).padEnd(4, "0")) >= filterMin && Number(String(Number(String(region.id).slice(2))).padEnd(4, "0")) <= filterMax).length / 2);

    const visualMin = Math.min(+slider1.value, +slider2.value);
    const visualMax = Math.max(+slider1.value, +slider2.value);

    range.style.left = `${visualMin / 59 * 100}%`;
    range.style.width = `${(visualMax - visualMin) / 59 * 100 * 0.97}%`;

    if(guessing) {
        loadQuestion();
    }
}

function setSliderText(min, max) {
    if (min == max){
        rangeText.textContent = `${min}`;
    }
    else if (min == 11 && max == 99){
        rangeText.textContent = "Everything";
    }
    else {
        rangeText.textContent = `${min} - ${max}`;
    }
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

    regions.forEach(region => {
        region.addEventListener("click", (e) => {
            if (!guessing) return;
            e.stopPropagation();
            reveal(region);
        });
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