var svg;
var regions;
var data;
var questions;

const marked = new Set();
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

var guessing = true;
var currentTarget = null;

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

const list = document.getElementById("selectedList");
const listBox = document.getElementById("selectedInfo");

async function loadSVG() {
try {
    const response = await fetch("SVG/Japan-Phone-Codes-Expert.svg");
    const svgText = await response.text();
    
    const map = document.getElementById("map");
    map.innerHTML = svgText;

    svg = map.querySelector("svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    viewBox = svg.viewBox.baseVal;
    baseWidth = viewBox.width;
    baseHeight = viewBox.height;

    regions = [...svg.querySelectorAll("path[id]")];

    addSvgEventListeners();
    loadData();

} catch (error) {
    console.log(error);
}}

async function loadData() {
try {
    const [csvResponse, jsonResponse] = await Promise.all([
        fetch("Json/data.csv"),
        fetch("Json/Japan-Phone-Codes.json")
    ]);

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

    questions = Object.entries(labelData).map(([id, correct]) => ({
        id,
        correct
    }));

    sortPaths();
    updateSlider();
    initializeCamera();

} catch (error) {
    console.log(error);
}}

function sortPaths() {
    regions.forEach(region => {
        if(data[region.id].level == 1) {
            region.classList.add("prefecturePath");
        }
        if(data[region.id].level == 3) {
            region.classList.add("municipalityPath");
        }
    });

}

function loadQuestion() {
    
    updateCooldowns();

    const available = questions.filter(r => !cooldowns[r.id]);
    const availableFiltered = available.filter(r => Number(String(r.id).padEnd(2, "0").slice(0, 2)) >= filterMin && Number(String(r.id).padEnd(2, "0").slice(0, 2)) <= filterMax);
    const pool = availableFiltered.length ? availableFiltered : questions;

    currentTarget = pool[Math.floor(Math.random() * pool.length)];

    cooldowns[currentTarget.id] = COOLDOWN_TURNS;

    const name = currentTarget.name ||currentTarget.id;
    document.getElementById(questionText).textContent = "0" + name;

    guessing = true;

    regions.forEach(region => {
        if(data[region.id].level == 3) {
            region.classList.add("guessing");
        }
    });

}

function mark(region) {

    if (region.id.includes("prefecture")) return;

    if (marked.has(region.id)) {
        marked.delete(region.id);
        region.classList.remove("selected");
    } else {
        marked.add(region.id);
        region.classList.add("selected");
    }
    listBox.classList.remove("show");

    list.textContent = null;

    if(marked.size != 0){
        marked.forEach(region => {
            const row = document.createElement("div");
            row.className = "answerRow";

            row.innerHTML = `
                <span>${data[region]["base-en"]}</span>
                <span>|</span>
                <span>${data[region]["full-ja"].replace(/[0-9]/g, "")}</span>
            `;

            list.appendChild(row);
        })
        listBox.classList.add("show");
    }

}

function reveal() {

    guessing = false;

    regions.forEach(region => {
        region.classList.remove("guessing");
    });

    const answers = new Set(currentTarget.correct);
    
    let correct = new Set( [...marked].filter(id => answers.has(id)) );
    let wrong = new Set( [...marked].filter(id => !answers.has(id)) );
    let missing = new Set( [...answers].filter(id => !marked.has(id)) );

    list.textContent = null;

    regions.forEach(region => {
        region.classList.remove("selected");
        if (correct.has(region.id)) {
            region.classList.add("correct");
        }
        else if (wrong.has(region.id)) {
            region.classList.add("wrong");
        }
        else if (missing.has(region.id)) {
            region.classList.add("missing");
        }
    });

    marked.forEach(region => {
        const row = document.createElement("div");
        row.className = "answerRow";

        row.innerHTML = `
            <span>${data[region]["base-en"]}</span>
            <span>|</span>
            <span>${data[region]["full-ja"].replace(/[0-9]/g, "")}</span>
        `;

        if (correct.has(region)) {
            row.classList.add("correctRow");
        }
        else {
            row.classList.add("wrongRow");
        }

        list.appendChild(row);
    })

    missing.forEach(region => {
        const row = document.createElement("div");
        row.className = "answerRow";

        row.innerHTML = `
            <span>${data[region]["base-en"]}</span>
            <span>|</span>
            <span>${data[region]["full-ja"].replace(/[0-9]/g, "")}</span>
        `;

        row.classList.add("missingRow");

        list.appendChild(row);
    })

    marked.clear();
    
    listBox.classList.add("show");
    document.getElementById("legendBox").classList.add("show");
}

function resetAndContinue() {
    if (guessing) return;

    list.textContent = null;

    listBox.classList.remove("show");

    regions.forEach(region => {
        region.classList.remove("correct");
        region.classList.remove("wrong");
        region.classList.remove("missing");
    });

    marked.clear();
    regions.forEach(region => {
        region.classList.remove("selected");
    })

    document.getElementById("legendBox").classList.remove("show");
    document.getElementById("selectedItem").classList.remove("show");

    loadQuestion()
}

function markNotGuessing(region) {
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
    document.getElementById("selectedItem").textContent = null;

    if (marked.size != 0) {
        document.getElementById("selectedItem").classList.add("show");
    }
    else {
        document.getElementById("selectedItem").classList.remove("show");
        return;
    }


    marked.forEach(region => {
        const row = document.createElement("div");
        row.className = "answerRow";

        row.innerHTML = `
            <span>${data[region]["base-en"]}</span>
            <span>|</span>
            <span>${data[region]["full-ja"].replace(/[0-9]/g, "")}</span>
        `;

        document.getElementById("selectedItem").appendChild(row);
    })
}

function updateSlider() {
    const min = Math.min(sliderIndex[slider1.value], sliderIndex[slider2.value]);
    const max = Math.max(sliderIndex[slider1.value], sliderIndex[slider2.value]);

    setSliderText(min, max);

    filterMin = min;
    filterMax = max;

    marked.clear();
    Object.keys(cooldowns).forEach(k => delete cooldowns[k]);

    COOLDOWN_TURNS = Math.round(questions.filter(r => Number(String(r.id).padEnd(2, "0").slice(0, 2)) >= filterMin && Number(String(r.id).padEnd(2, "0").slice(0, 2)) <= filterMax).length / 2);

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

function updateCooldowns() {
    for (const id in cooldowns) {
        cooldowns[id]--;
        if (cooldowns[id] <= 0) delete cooldowns[id];
    }
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

function addSvgEventListeners() {
    regions.forEach(region => {
        region.addEventListener("click", (e) => {
            if (!guessing) {
                markNotGuessing(region);
                return;
            }
            e.stopPropagation();
            mark(region);
        });
    });

    svg.addEventListener("mousedown", e => {
        isPanning = true;

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

    }, { passive:false });
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

document.addEventListener("keydown", (e) => {
    switch (e.code){
        case "Space":
        case "Enter":
            if (guessing) {
                reveal()
                break;
            }
            else {
                resetAndContinue();
                break;
            }
        }
});

window.buttonPress = function() {
    if (guessing) {
        reveal()
    }
    else {
        resetAndContinue();
    }
};

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

loadSVG();