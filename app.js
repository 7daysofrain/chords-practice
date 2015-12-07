#! /usr/bin/env node

var midi = require('midi');
var player = require('play-sound')(opts = {});
var keypress = require('keypress');

keypress(process.stdin);

var input = new midi.input();

console.log("Chard practice.");
console.log("Dispositivos MIDI disponibles: ");

for(var i = 0 ; i < input.getPortCount() ; i++){
	console.log("\t-->" + input.getPortName(i) + "(" + i + ")");
}

var notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
var someChords = [
					{name: "Do", chord: "C E G", sound: "do.mp3"},
					{name: "Re", chord: "D F# A", sound: "re.mp3"},
					{name: "Mi", chord: "E G# B", sound: "mi.mp3"},
					{name: "Fa", chord: "F A C", sound: "fa.mp3"},
					{name: "Sol", chord: "G B D", sound: "sol.mp3"},
					{name: "La", chord: "A C# E", sound: "la.mp3"},
					{name: "Si", chord: "B D# F#", sound: "si.mp3"}
];
var chordsNameMap = [];
for(var i = 0 ; i < someChords.length ; i++){
	chordsNameMap[someChords[i].chord] = someChords[i].name;
}
var chordInterval;
var level;
var question;
var qTime = 0;
var playingChord = [];
var stats = {
	bestTime:Number.POSITIVE_INFINITY,
	worstTime:0,
	times: [],
	tries: 0,
	good: 0,
	bad: 0
};
start();


function start(){
	var inquirer = require("inquirer");
	inquirer.prompt([

				{
					type: "input",
					name: "port",
					message: "¿Cual quieres conectar?"
				},
				{
					type: "input",
					name: "level",
					message: "¿Dificultad? (1-7)"
				}], function( answers ) {
				connect(Number(answers.port));
				detectExit();
				console.log("Empezando en 3 segundos");
				setTimeout(function(){
					startGame(Number(answers.level));
				},3000);

			}
	);
}
function connect(port){

// Configure a callback.
	input.on('message', function(deltaTime, message) {
		// The message is an array of numbers corresponding to the MIDI bytes:
		//   [status, data1, data2]
		// https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
		// information interpreting the messages.


		// console.log('m:' + message + ' d:' + deltaTime);
		if(message[0].toString(16).indexOf("9") == 0 && message[2] > 0){
			// OK es una nota
			var code = message[1];
			var note = notes[code%12];
			var octave = Math.floor(code/12) - 2;
			var played = note + octave;
			console.log("Played: " + played);
			if(deltaTime > 0.09){
				// Track as new chord
				playingChord = [played];
			}
			else{
				playingChord.push(played);
			}
		}
		else if (message[2] == 0){
			playingChord = [];
		}
	});

	var name = input.getPortName(port);
	input.openPort(Number(port));

	chordInterval = setInterval(chechChord,300);

	console.log("connected to " + name);
}
function chechChord(){
	if(playingChord.length >= 3){
		var chord = playingChord
				.map(function(item){ return item.substr(0,item.length-1)})
				.slice()
				.sort(function(a,b){return a < b})
				.reduce(function(a,b){if (a.slice(-1)[0] !== b) a.push(b);return a;},[])
				.sort()
				.join(" ");
		var name = chordsNameMap[chord] || "Unknown";
		console.log("Chord detected: " + chord + " (" + name + ")");
		playingChord = [];
		var deltaTime = new Date().getTime() - qTime;
		stats.times.push(deltaTime);
		stats.bestTime = Math.min(stats.bestTime,deltaTime);
		stats.worstTime = Math.max(stats.worstTime,deltaTime);

		stats.tries++;
		if(chord == question.chord.split(" ").sort().join(" ")){
			console.log("!Muy bien Joseba! " + deltaTime + "ms. ¡Más rápido!");
			player.play('./sound/muybien.mp3');
			stats.good++;
		}
		else{
			console.log("Noooo, venga no seas paquete, estamos en nivel " + level);
			player.play('./sound/fatal.mp3');
			stats.bad++;
		}
		setTimeout(ask,1000);
	}
}
function startGame(l){
	level = l;
	ask();
}
function ask(){
	question = someChords[Math.floor(Math.random() * level)];
	qTime = new Date().getTime();
	console.log("Vamos Joseba, dame un " + question.name);
	player.play('./sound/' + question.sound, function(err){})
}

function detectExit(){
	console.log("Press SPACE to exit");
	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.on('keypress', function (letter, key) {
		//console.log(letter,key);
		if (key && key.name == 'space') {
			console.log("-------STATS--------");
			console.log("Level: " + level);
			console.log("Aciertos: " + stats.good + " de " + stats.tries + " (" + Math.round((stats.good / stats.tries) * 100) + "%)");
			console.log("Fallos: " + stats.bad + " de " + stats.tries + " (" + Math.round((stats.bad / stats.tries) * 100) + "%)");
			console.log("Mejor tiempo: " + stats.bestTime + "ms.");
			console.log("Peor tiempo: " + stats.worstTime + "ms.");
			var sum = 0;
			filterOutliers(stats.times).forEach(function(it){sum+=it});
			console.log("Media tiempo: " + Math.floor(sum/stats.tries) + "ms.")
			input.closePort();
			clearInterval(chordInterval);
			process.exit();
		}
	});
}
function filterOutliers(someArray) {

	// Copy the values, rather than operating on references to existing values
	var values = someArray.concat();

	// Then sort
	values.sort( function(a, b) {
		return a - b;
	});

	/* Then find a generous IQR. This is generous because if (values.length / 4)
	 * is not an int, then really you should average the two elements on either
	 * side to find q1.
	 */
	var q1 = values[Math.floor((values.length / 4))];
	// Likewise for q3.
	var q3 = values[Math.ceil((values.length * (3 / 4)))];
	var iqr = q3 - q1;

	// Then find min and max values
	var maxValue = q3 + iqr*1.5;
	var minValue = q1 - iqr*1.5;

	// Then filter anything beyond or beneath these values.
	var filteredValues = values.filter(function(x) {
		return (x < maxValue) && (x > minValue);
	});

	// Then return
	return filteredValues;
}