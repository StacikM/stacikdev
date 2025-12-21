const socket = io("https://server.ctksystem.com")

const boardEl = document.getElementById("bingo-board")
const statusEl = document.getElementById("status")

let calledNumbers = []
let name = prompt("Your name")

const ranges = [
  [1,15],[16,30],[31,45],[46,60],[61,75]
]

let cells = []
let numbers = []
let marked = Array(25).fill(false)

// ---- BUILD BOARD ----
function generateBoard() {
  boardEl.innerHTML = ""
  cells = []
  numbers = []

  const headers = ["B","I","N","G","O"]
  headers.forEach(h=>{
    const d=document.createElement("div")
    d.className="cell header"
    d.textContent=h
    boardEl.appendChild(d)
  })

  let cols = ranges.map(([a,b]) =>
    shuffle([...Array(b-a+1)].map((_,i)=>i+a)).slice(0,5)
  )

  for(let r=0;r<5;r++){
    for(let c=0;c<5;c++){
      const i=r*5+c
      const d=document.createElement("div")
      d.className="cell"

      if(r===2 && c===2){
        d.textContent="FREE"
        d.classList.add("marked")
        marked[i]=true
        numbers[i]="FREE"
      } else {
        const num = cols[c][r]
        d.textContent=num
        numbers[i]=num
        d.onclick=()=>tryMark(i,d)
      }

      cells.push(d)
      boardEl.appendChild(d)
    }
  }
}

function tryMark(i, cell){
  if(!calledNumbers.includes(numbers[i])) return
  marked[i]=true
  cell.classList.add("marked")
  checkBingo()
}

// ---- BINGO CHECK ----
const lines = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],
  [15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],
  [3,8,13,18,23],[4,9,14,19,24],
  [0,6,12,18,24],[4,8,12,16,20]
]

function checkBingo(){
  lines.forEach(l=>{
    if(l.every(i=>marked[i])){
      l.forEach(i=>cells[i].classList.add("bingo"))
      socket.emit("bingo", name)
      statusEl.textContent="🎉 BINGO!"
    }
  })
}

// ---- SOCKET EVENTS ----
socket.on("number_called", n=>{
  calledNumbers.push(n)
})

socket.on("bingo", n=>{
  alert("BINGO: " + n)
})

socket.on("game_ended", ()=>{
  alert("WARNING!\nClient disconnected with error\n\nYour game client has disconnected, this might be because the game ended")
})

// ---- UTIL ----
function shuffle(a){ return a.sort(()=>Math.random()-0.5) }

generateBoard()
