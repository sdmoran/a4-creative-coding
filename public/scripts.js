// Constants/globals
var CLIENT_ID = null; 
var CLIENT_NAME = "";
var canvas;
var ctx;
var prev;
var curr;
var lineWidth = 10;
var color = "#000000"
var colors = ["#000000", "#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#00FFFF", "#007FFF", "#0000FF", "#7F00FF", "#FF00FF", 
              "#FFFFFF", "#E05151", "#E09951", "#E0E051", "#51E051", "#51E0E0", "#5199E0", "#5151E0", "#9951E0", "#E051E0", ]

// WEBSOCKET
const ws = new WebSocket('wss://' + location.host);

// Vue app, yay Vue!
const app = new Vue({
    el: "#app",
    data: {
        players: [],
        messages: [],
        word: "",
        timeLeft: null,
        isLeader: false,
        canDraw: false,
        started: false,
        gameFinished: false,
    },
    methods: {
        sendStart: function() {
            let e = document.getElementById("numRounds")
            let numRounds = e.options[e.selectedIndex].text;
          
            e = document.getElementById("secondsPerRound")
            let secondsPerRound = e.options[e.selectedIndex].text;
          
            ws.send(JSON.stringify({
                id: CLIENT_ID,
                command: "START",
                numRounds: parseInt(numRounds),
                secondsPerRound: parseInt(secondsPerRound)
            }))
        }
    }
})

// Get canvas context
window.onload = function() {
    canvas = document.getElementById('canvasArea');
    ctx = canvas.getContext('2d');
  
    // Display modal
    $('#helpModal').modal();

    document.getElementById('joinButton').onclick = function() {
        // Get rid of attributes - no longer need them
        document.getElementById('joinButton').remove();
        CLIENT_NAME = document.getElementById('nameField').value;
        document.getElementById('nameField').remove();

        // Register client with server
        registerPlayer();

        document.getElementById('clearButton').onclick = function() {
            if(app.canDraw) {
                sendClear();
                clear();
            }
        }

        // Setup stroke buttons
        for(let i = 10; i <= 50; i+= 10) {
            const strokeButton = document.createElement('button');
            strokeButton.innerText = i;
            strokeButton.id = `strokeButton${i}`
            strokeButton.classList = "btn btn-primary"
            document.getElementById('strokeButtonContainer').appendChild(strokeButton);
            document.getElementById(`strokeButton${i}`).addEventListener("click", function() {lineWidth = i});
        }

        // Setup color buttons
        for(let i = 0; i < colors.length; i++) {
            const colorButton = document.createElement('button');
            colorButton.innerText = "x";
            colorButton.id = `colorButton${i}`
            colorButton.classList += "btn"
            colorButton.style = `background-color: ${colors[i]}; color: ${colors[i]}; border: 1px black solid;`;
            document.getElementById('colorButtonContainer').appendChild(colorButton);
            document.getElementById(`colorButton${i}`).addEventListener("click", function() {color = colors[i]});
        }

        // Set listener for chat messages
        var msgBox = document.getElementById('messageBox')
        msgBox.addEventListener("keydown", e => {
            if(e.keyCode === 13 && msgBox.value.length >= 3) {
                var guess = msgBox.value;
                msgBox.value = "";
                sendGuess(guess);
            }
        })
    }
}

function move(e) {
    if(e.buttons && app.canDraw) {
        if(!prev) {
            prev = {x: e.offsetX, y: e.offsetY}
            return
        }
        curr = {x: e.offsetX, y: e.offsetY}
        draw(color, lineWidth, prev, curr)
        sendDraw();
        prev = curr;
    }
}

function draw(style, width, p1, p2) {
    ctx.beginPath();
    ctx.strokeStyle = style;
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke();
}

function setWidth(i) {
    lineWidth = i;
}

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
}

window.onmousemove = move;

// Make it so strokes don't connect to prev stroke between holding mouse down
window.onclick = function() {
    prev = null;
}


ws.onopen = () => {
    console.log("Connected to server!")
}

ws.onmessage = (message) => {
    console.log(message.data)
    // Handle receiving message

    const obj = JSON.parse(message.data)

    if(obj.command === "ID") {
            CLIENT_ID = obj.id;
            console.log(CLIENT_ID);
            console.log(obj)
            app.isLeader = obj.isLeader;
    }
    else if(obj.command === "START") {
        app.started = true;
        app.gameFinished = false;
    }
    else if(obj.command === "GUESS") {
        app.messages.push({player: obj.name, message: obj.guess})
        // Needs a short timeout to make sure Vue adds the element before we scroll
        setTimeout(function() {
            // Scroll to bottom
            var elem = document.getElementById('guessBox');
            elem.scrollTop = elem.scrollHeight;
        })
    }
    else if(obj.command === "CORRECT") {
        app.messages.push({player: obj.name, correct: true});
        let correctPlayer = app.players.find((p) => p.name === obj.name);
        correctPlayer.correct++;
        correctPlayer.correctThisDrawing = true;
    }
    else if(obj.command === "WORD") {
        app.word = obj.word;
        // On new word, reset correctThisDrawing for all players.
        for(let i = 0; i < app.players.length; i++) {
          app.players[i].correctThisDrawing = false;
        }
    }
    else if(obj.command === "TICK") {
        app.timeLeft = obj.timeLeft;
    }
    else if(obj.command === "CLEAR") {
        clear();
    }
    else if(obj.command === "ENABLE_DRAW") {
        alert("You can now draw!")
        app.canDraw = true;
    }
    else if(obj.command === "DISABLE_DRAW") {
        app.canDraw = false;
    }
    else if(obj.command === "DRAW" && obj.id != CLIENT_ID) {
        draw(obj.color, obj.lineWidth, obj.p1, obj.p2);
    }
    else if(obj.command === "CLEAR") {
        clear();
    }
    else if(obj.command === "UPDATE_PLAYERS") {
        app.players = obj.players;
    }
    else if(obj.command === "GAME_OVER") {
        app.messages = [];
        app.word = "";
        app.timeLeft = null;
        app.canDraw = false;
        app.started = false;
        app.gameFinished = true;
    }
}

const registerPlayer = function() {
    const obj = {
        command: "NEW_PLAYER",
        name: CLIENT_NAME
    }
    ws.send(JSON.stringify(obj));
}

const sendDraw = function() {
    console.log("Sending draw...")
    const obj = {
        id: CLIENT_ID,
        command: "DRAW",
        color: color,
        lineWidth: lineWidth,
        p1: prev,
        p2: curr
    }
    ws.send(JSON.stringify(obj))
}

const sendClear = function() {
    ws.send(JSON.stringify({
        id: CLIENT_ID,
        command: "CLEAR"
    }))
    clear();
}

const sendGuess = function(guess) {
    ws.send(JSON.stringify({
        id: CLIENT_ID,
        command: "GUESS",
        guess: guess
    }))
}