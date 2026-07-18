var svg;
var regions;
var data;
var questions;

const marked = new Set();
var COOLDOWN_TURNS = 0;
const cooldowns = {};

var guessing = false;
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

    addSvgEventListeners();
    loadData();

} catch (error) {
    console.error('Error reading file:', error);
}}

async function loadData() {
    const [csvResponse, jsonResponse] = await Promise.all([
        fetch("Json/data-prefectures.csv"),
        fetch("Json/Japan-Road-Diamonds.json")
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

    const jsonData = await jsonResponse.json();
    questions = jsonData;

    questions.forEach(q => {
        q.correct = new Set(q.correct);
    });

    COOLDOWN_TURNS = Math.round(questions.length / 2);


    initializeCamera();
    loadQuestion();
    animate();
}

function updateCooldowns() {
    for (const id in cooldowns) {
        cooldowns[id]--;
        if (cooldowns[id] <= 0) delete cooldowns[id];
    }
}

function loadQuestion() {
    updateCooldowns();

    const available = questions.filter(r => !cooldowns[r.id]);
    const pool = available.length ? available : questions;

    currentTarget = pool[Math.floor(Math.random() * pool.length)];

    cooldowns[currentTarget.id] = COOLDOWN_TURNS;

    document.getElementById(currentTarget.id).classList.add('shown');
    document.getElementById(currentTarget.id).classList.remove('layer');
    
    guessing = true;

    regions.forEach(region => {
        region.classList.add("guessing");
    });
}

function mark(region) {

    if (marked.has(region.id)) {
        marked.delete(region.id);
        region.classList.remove("selected");
    } else {
        marked.add(region.id);
        region.classList.add("selected");
    }
    document.getElementById("selectedInfo").classList.remove("show");

    document.getElementById("selectedList").textContent = null;

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
        document.getElementById("selectedInfo").classList.add("show");
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

    document.getElementById("selectedList").textContent = null;

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

    document.getElementById("legendBox").classList.add("show");
    document.getElementById("selectedInfo").classList.add("show");
}

function resetAndContinue() {
    if (guessing) return;

    document.getElementById("selectedInfo").classList.remove("show");

    document.getElementById("selectedList").textContent = null;

    regions.forEach(region => {
        region.classList.remove("correct");
        region.classList.remove("wrong");
        region.classList.remove("missing");
    });

    marked.clear();

    document.getElementById(currentTarget.id).classList.remove('shown');
    document.getElementById(currentTarget.id).classList.add('layer');

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