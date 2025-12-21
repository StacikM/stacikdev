const socket = io("https://server.ctksystem.com")
let board=[]

document.getElementById("connect").onclick = async ()=>{
  const res = await fetch("https://server.ctksystem.com/game/active")
  const data = await res.json()
  if(!data.active) return alert("I am not hosting a game right now or your internet connection is bad")

  const name = prompt("Name")
  socket.emit("join", name)

  board = Array.from({length:25},(_,i)=>{
    if(i===12) return "FREE"
    return Math.floor(Math.random()*75)+1
  })

  render()
  socket.emit("submit_board", board)
}

function render(){
  const d=document.getElementById("board")
  d.innerHTML=""
  board.forEach(n=>{
    const b=document.createElement("div")
    b.textContent=n
    b.style.border="1px solid black"
    b.style.display="inline-block"
    b.style.width="40px"
    b.style.height="40px"
    b.style.textAlign="center"
    d.appendChild(b)
  })
}

socket.on("number",n=>alert("Number: "+n))
socket.on("bingo",name=>alert("BINGO: "+name))
socket.on("game_ended",()=>alert("WARNING\n\nYour client has disconnected from the game server. This may be because of a connection loss or the game has ended"))
