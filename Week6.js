
// vocal, drum, bass, and other are volumes ranging from 0 to 100
function draw_one_frame(words, vocal, drum, bass, other, counter) {
   background(80);

   angleMode(DEGREES);

   let midX = canvasWidth  / 2;
   let midY = canvasHeight / 2;  

   let color1 = color(180, 255, 99);
   let color2 = color(255, 94, 94); 


   let amt = map (other, 0, 100, 0, 1);
   let changingColor = lerpColor(color1, color2, amt);


   let sunSize = map (other, 0, 100, 50, 400);
   let strokeThickness = map (other, 0, 100, 10, 100);


   fill (changingColor);
   stroke(255, 204, 0);
   strokeWeight (strokeThickness);
   
   for(let i = 0; i<=5; i++) {

      ellipse (midX+(i*-100), midY+(i*-100), sunSize+(i*-50), sunSize+(i*-50));

      
   }



//use websafe fonts









}