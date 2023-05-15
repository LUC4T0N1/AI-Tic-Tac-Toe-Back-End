# Multiplayer-AI-Tic-Tac-Toe
[![NPM](https://img.shields.io/npm/l/react)](https://github.com/LUC4T0N1/AI-Tic-Tac-Toe-Back-End/blob/main/LICENSE)

# About the project
https://online-tictactoe.netlify.app/

A system that allows you to play tic-tac-toe in different ways.
It uses some artificial intelligence algorithms, which allows you to play alone against the computer in 3 different difficulties: easy | random | ultra hard.
In addition, Socket.IO is used to implement a multiplayer mode, which allows you to play against another person while chatting with them, be it a random opponent or a specific friend.
This is the Back End repo of the project, the Front End repo is here: https://github.com/LUC4T0N1/Multiplayer-AI-Tic-Tac-Toe

## Functionalities
In this website you can switch between portuguese and english languages, and dark or white mode using the buttons on the navbar.

![Navbar](https://github.com/LUC4T0N1/projects-prints/raw/master/tic-tac-toe/switch.PNG)

## Modes
There are two main modes -> Singleplayer and Multiplayer

### Singleplayer
In singleplayer mode, the system gives you 3 different difficulties top choose:
- Easy -> it uses the minmax algorithm to calculate the worst play as possible making the player always win
- Random -> it makes random plays
- Ultra Hard -> it uses the minmax algorithm to calculate the best play as possible making the player never win

### Multiplayer
In Multiplayer mode, the system uses websockets to create a connection between the players, who have 2 options:
- Random opponent -> It puts you in a queue and matches you with another player in that queue.
![Queue](https://github.com/LUC4T0N1/projects-prints/raw/master/tic-tac-toe/Queue.png)
- Play with a friend -> You can create a private room to play with a friend.
![CustomRoom](https://github.com/LUC4T0N1/projects-prints/raw/master/tic-tac-toe/CustomRoom.png)

In addition to the game, the multiplayer mode provides a live chat for players to communicate with each other.
![CustomRoom](https://github.com/LUC4T0N1/projects-prints/raw/master/tic-tac-toe/Game.png)

## Mobile Layout
![Mobile](https://github.com/LUC4T0N1/projects-prints/raw/master/tic-tac-toe/mobile.PNG)


## Used Technologies

### Back End

- NodeJS | Socket.IO | JAVASCRIPT

### Front End

- React
- HTML | CSS | JAVASCRIPT

## Deploy
- Netlify [Front End]
- Railway [Back End]

## How to run the project
```bash
#clone repo
git clone https://github.com/LUC4T0N1/Multiplayer-AI-Tic-Tac-Toe

#run project

Open a terminal:
  npm install
  cd src
  node index.js
```

## Author

Lucas Moniz de Arruda

https://www.linkedin.com/in/lucas-moniz-de-arruda/
