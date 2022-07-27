const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
require("dotenv").config();
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const cors = require('cors');

let queuePlayers = []
let actualQueue = 1
let customRooms = []

app.use(cors());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", (data) => {
    console.log("data " + data)
    socket.join(data);
    console.log(`User with ID: ${socket.id} joined room: ${data}`);
    let room = customRooms.filter(r => r = data);
    console.log("tamanho sala: " + room.length)
    console.log("sala: " + room)
    if(room.length === 0){
      console.log("sala criada: " + data);
      customRooms.push(data)
    }else{  
      io.to(data).emit("room-ready", data);
      console.log("enviando room ready")
      const index = customRooms.indexOf(data);
      if (index > -1) { 
        customRooms.splice(index, 1); 
      }
    }
  });

  socket.on("send_message", (data) => {
    console.log("mensagem recebida: " + JSON.stringify(data))
    socket.to(data.room).emit("receive_message", data);
  });

  socket.on("select_letter", (data) => {
    console.log("mensagem recebida: " + JSON.stringify(data))
    socket.to(data.room).emit("letter_selected", data);
  });

  socket.on("game-move", (data) => {
    console.log("mensagem recebida: " + JSON.stringify(data))
    socket.to(data.room).emit("game-move", data);
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });

  socket.on("player-ready", (data) => {
    socket.to(data.room).emit("player-ready", data);
    console.log(`User with ID: ${socket.id} is ready`);
  })

  socket.on("room-ready", (data) => {
    socket.to(data.room).emit("room-ready", data);
    console.log(`Room with id: ${data.room} is ready`);
  })

  socket.on("join_queue", (player) => {
    console.log("Novo player na fila geral: " + JSON.stringify({player: player, id: socket.id, position: queuePlayers.length + 1}))
    queuePlayers.push({player: player, id: socket.id, position: queuePlayers.length + 1}) 
    console.log("Fila geral atual: ")
    for(let i = 0; i< queuePlayers.length; i++){
      console.log(JSON.stringify(queuePlayers[i]));
    }
    console.log("tamanho da fila geral atual: " + queuePlayers.length);
    console.log("Player: " + JSON.stringify({player: player, id: socket.id, position: queuePlayers.length}) + "entrando na fila " + actualQueue)
    socket.join(actualQueue);
    if((queuePlayers.length) % 2 == 0){
      console.log("começando jogo na fila " + actualQueue)
      io.to(actualQueue).emit("game_start", actualQueue);
      console.log("passou")
      queuePlayers = []
      actualQueue = actualQueue + 1;
      if(actualQueue === 100000){
        actualQueue = 1
      }
    }
  });

});


server.listen(8080, () => {
  console.log('listening on port *' + process.env.PORT  + '!!!' );
});