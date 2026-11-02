export function sceneLayout(debug: boolean) {
  const panel = debug && innerWidth > 1000 ? 340 : 0;
  const available = innerWidth - panel;
  const marginX = Math.max(70, available * .10);
  const marginY = Math.max(100, innerHeight * .15);
  return { x: marginX, y: marginY, width: available - marginX * 2, height: innerHeight - marginY * 2 };
}
