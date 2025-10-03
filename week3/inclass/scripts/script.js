let cBox = document.getElementById("colorBox");
let colorBtn = document.getElementById("changeColor")
let ImgBox = document.getElementById("RabbitImage")
let ImageBtn = document.getElementById("toggleImage")

let assignRandomColor = function() 
{
   let rCoup = 255 * Math.random()
   let gCoup = 255 * Math.random()
   let bCoup = 255 * Math.random()
   cBox.style.backgroundColor = "rgb("+rCoup+","+gCoup+","+bCoup+")"    
}

const togglerabbitImage =   () =>
{
    console.log(imgBox.src)
    if (imgBox.src.includes("Rabbit1.jpg")) 
    {
        console.log("chaging to Rabbit2")
        imgBox.src = "assets/Rabbit2.jpg"
    }

}
ImageBtn.addEventListener("click", toggleRabbitImage)
colorBtn.addEventListener("click", assignRandomColor)