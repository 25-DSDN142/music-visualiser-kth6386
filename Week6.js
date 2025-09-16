
// vocal, drum, bass, and other are volumes ranging from 0 to 100
function draw_one_frame(words, vocal, drum, bass, other, counter) {
   background(10);

   angleMode(DEGREES);

   let midX = canvasWidth  / 2;
   let midY = canvasHeight / 2;  

   let color1 = color(180, 255, 99);
   let color2 = color(255, 94, 94); 


   let amt = map (other, 0, 100, 0, 1);
   let changingColor = lerpColor(color1, color2, amt);


   let sunSize = map (bass, 0, 100, 50, 400);
   let strokeThickness = map (bass, 0, 100, 10, 100);


   fill (changingColor);
   stroke(255, 204, 0);
   strokeWeight (strokeThickness);
   
   for(let i = 0; i<=5; i++) {

      ellipse (midX+(i*-100), midY+(i*-100), sunSize+(i*-50), sunSize+(i*-50));

      
   }



// beam
push();
translate(midX, midY);
rotate(32); // angle

// var
let beamLen   = height * 0.85;                 
let maxWidth  = map(drum, 0, 100, 24, 60);   
let layers    = 500;                          

// tapered glow
for (let i = 0; i <= layers; i++) {
  // t: -1(윗끝) ~ 1(아랫끝), y: 빔 축 방향 위치
  let t  = map(i, 0, layers, -1, 1);
  let y  = t * (beamLen / 2);

  // falloff
  let fall = pow(1 - abs(t), 1.7);

  // thickness, brightness
  let halfW = maxWidth * fall;                 
  let alpha = 40 + 210 * fall;                 

  stroke(255, 220, 120, alpha);                // gold
  strokeWeight(1);                             
  line(-halfW, y, halfW, y);                  
}

// beam core line
stroke(255, 245, 220, 230);
strokeWeight(map(bass, 0, 100, 1, 7));
line(0, -beamLen/2, 0, beamLen/2);

pop();
}

let noOfStars = 10000; 
sizeDiff = 0.18; 
majorAxisMinLen = 10; 
widthHeightRatio = 0.7; 
rotationGradient, rotationGradientSlider, stars = [];