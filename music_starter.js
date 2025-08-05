
// vocal, drum, bass, and other are volumes ranging from 0 to 100
function draw_one_frame(words, vocal, drum, bass, other, counter) {
   background(80);

   angleMode(DEGREES);

   let midX = canvasWidth  / 2;
   let midY = canvasHeight / 2;  

   let sunSize = map (drum, 0, 100, 50, 400);
   let strokeThickness = map (other, 0, 100, 10, 100);
   let lineLength = map (vocal, 0, 100, 10, 200);

   fill (219, 255, 161);
   ellipse (midX, midY, sunSize);
   stroke(255, 204, 0);
   strokeWeight (strokeThickness);
   
   push ();

   stroke(50, 168, 82);
   strokeWeight (strokeThickness);
   line (midX - lineLength, midY + lineLength, midX + lineLength, midY + lineLength);

   pop ();




//use websafe fonts









}