type AppMode = 'startPos' | 'drawPath';

class FeildCanvas {
  private backgroundImage: HTMLImageElement | null = null;
  private mouseDown: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private points: Point[] = [];
  
  // App State
  private mode: AppMode = 'startPos';
  private startPoint: Point | null = null;
  private debugMode: boolean = false;

  // DOM Elements
  private canvas = document.getElementById("canvas") as HTMLCanvasElement;
  private ctx = this.canvas.getContext("2d");
  private coordsUi = document.getElementById("mouse-coords");
  private startUi = document.getElementById("start-coords");
  private sequenceUi = document.getElementById("path-sequence");
  
  private btnStartPos = document.getElementById("btn-mode-start");
  private btnDrawPath = document.getElementById("btn-mode-path");
  private btnClear = document.getElementById("btn-clear");
  private btnExport = document.getElementById("btn-export");
  private btnQr = document.getElementById("btn-qr");
  private qrOverlay = document.getElementById("qr-overlay");
  private btnCloseQr = document.getElementById("btn-close-qr");
  private qrCanvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
  private qrPointCount = document.getElementById("qr-point-count");

  private checkDebug = document.getElementById("check-debug") as HTMLInputElement;

  constructor() {
    this.canvas.style.touchAction = "none";
    this.init();
  }

  // Sets up the website and loads in the image asynchronsuly so that it does not cause issues
  private async init() {
    await this.loadImage("field26.png");
    this.setupCanvas();
    this.attachEventListeners();
    this.attachUIListeners();
    this.setupDebugGlobal();
    this.updateRender();
  }

  // Sets up the visuallization of the zones
  private setupDebugGlobal() {
    (window as any).debug = (state?: boolean) => {
      this.debugMode = state !== undefined ? state : !this.debugMode;
      this.updateRender();
      console.log(`[SYS] Debug visualization: ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
    };
  }


  private loadImage(src: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.backgroundImage = img;
        resolve();
      };
    });
  }

  // Sets the image to scale with the browser and the size of the image
  private setupCanvas() {
    if (!this.backgroundImage || !this.ctx) return;
    
    const scale = 0.5;
    const newWidth = this.backgroundImage.naturalWidth * scale;
    const newHeight = this.backgroundImage.naturalHeight * scale;

    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.canvas.style.width = newWidth + "px";
    this.canvas.style.height = newHeight + "px";
  }


  // Sets up the style for the lines
  private applyStrokeSettings() {
    if (!this.ctx) return;
    this.ctx.lineCap = "round";
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = "#2bff00ff"; // Electric Green
    // this.ctx.shadowBlur = 10;
    // this.ctx.shadowColor = "#00f0ff";
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  // Draws the image to the canvas
  private drawBackground() {
    if (!this.ctx || !this.backgroundImage) return;
    
    this.ctx.save();
    
    // Apply cyberpunk blueprint filter over the field image
    // this.ctx.filter = "grayscale(80%) sepia(50%) hue-rotate(180deg) brightness(0.3) contrast(1.2)";
    this.ctx.drawImage(
      this.backgroundImage,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    
    this.ctx.restore();
  }

  private updateRender(currentPathDraw: boolean = false) {
    if (!this.ctx) return;
    
    // Clear & draw background
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackground();

    // Draw Start Point (first point in the array)
    if (this.points.length > 0) {
      this.drawStartNode(this.points[0]);
    }

    // Draw Catmull-Rom Path if we have points and are not currently drawing
    if (!currentPathDraw && this.points.length > 1) {
      this.applyStrokeSettings();
      this.drawCatmullRom(this.points);
    }

    // Visual Debug for Regions
    this.drawDebugRegions();

    // Update Sequence UI
    if (this.sequenceUi) {
      this.sequenceUi.innerText = this.getPathSequence();
    }
  }

  private drawStartNode(p: Point) {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(p.xPos, p.yPos, 8, 0, Math.PI * 2);
    this.ctx.fillStyle = "#000";
    this.ctx.fill();
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = "#eaff00"; // Fluent Yellow
    this.ctx.shadowColor = "#eaff00";
    this.ctx.shadowBlur = 15;
    this.ctx.stroke();

    // Crosshair target inside
    this.ctx.beginPath();
    this.ctx.moveTo(p.xPos - 4, p.yPos);
    this.ctx.lineTo(p.xPos + 4, p.yPos);
    this.ctx.moveTo(p.xPos, p.yPos - 4);
    this.ctx.lineTo(p.xPos, p.yPos + 4);
    this.ctx.strokeStyle = "#eaff00";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawCatmullRom(points: Point[]) {
    if (!this.ctx || points.length < 2) return; // Makes sure that there is enough points
    
    const steps = 20; // samples per segment, higher = smoother
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].xPos, points[0].yPos);

    for (let i = 0; i < points.length - 1; i++) {

      // Sets up the 4 points that the algorithym needs to runb
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      for (let step = 1; step <= steps; step++) {

        // Sets the time steps for the parametric t value
        const t = step / steps;
        const t2 = t * t;
        const t3 = t2 * t;


        // Creates the merged cubic bezier by using a "cubic hermite blend" to create a cubic line between the points.
        // Uses derivitives I beleive (a bit out of my pay grade and its been a bit sence I have taken calc 2)
        const x = 0.5 * (
          (2 * p1.xPos) +
          (-p0.xPos + p2.xPos) * t +
          (2 * p0.xPos - 5 * p1.xPos + 4 * p2.xPos - p3.xPos) * t2 +
          (-p0.xPos + 3 * p1.xPos - 3 * p2.xPos + p3.xPos) * t3
        );

        const y = 0.5 * (
          (2 * p1.yPos) +
          (-p0.yPos + p2.yPos) * t +
          (2 * p0.yPos - 5 * p1.yPos + 4 * p2.yPos - p3.yPos) * t2 +
          (-p0.yPos + 3 * p1.yPos - 3 * p2.yPos + p3.yPos) * t3
        );

        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();

    // Draw waypoints / nodes
    this.ctx.save();
    this.ctx.fillStyle = "#090a0f";
    this.ctx.strokeStyle = "#00ff00ff";
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = "#1eff00ff";
    for(let i = 1; i < points.length; i++) {
      const pt = points[i];
      this.ctx.beginPath();
      this.ctx.arc(pt.xPos, pt.yPos, 4, 0, Math.PI*2);
      this.ctx.fill();
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private getCanvasMousePos(e: PointerEvent): { x: number, y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const style = window.getComputedStyle(this.canvas);
    
    // Account for CSS borders
    const borderLeft = parseFloat(style.borderLeftWidth);
    const borderTop = parseFloat(style.borderTopWidth);
    const borderRight = parseFloat(style.borderRightWidth);
    const borderBottom = parseFloat(style.borderBottomWidth);
    
    // Get the actual rendered element area (excluding borders)
    const contentWidth = rect.width - borderLeft - borderRight;
    const contentHeight = rect.height - borderTop - borderBottom;
    
    // Calculate the actual size of the image inside the canvas element (due to object-fit: contain)
    const containerRatio = contentWidth / contentHeight;
    const canvasRatio = this.canvas.width / this.canvas.height;
    
    let actualRenderedWidth = contentWidth;
    let actualRenderedHeight = contentHeight;
    let xOffsetInContent = 0;
    let yOffsetInContent = 0;
    
    if (containerRatio > canvasRatio) {
      // Letterboxing on the sides
      actualRenderedWidth = contentHeight * canvasRatio;
      xOffsetInContent = (contentWidth - actualRenderedWidth) / 2;
    } else {
      // Letterboxing on top/bottom
      actualRenderedHeight = contentWidth / canvasRatio;
      yOffsetInContent = (contentHeight - actualRenderedHeight) / 2;
    }
    
    // Scale factor: internal buffer size / actual rendered size
    const scaleX = this.canvas.width / actualRenderedWidth;
    const scaleY = this.canvas.height / actualRenderedHeight;
    
    // Final coordinates relative to the top-left of the internal drawing buffer
    const x = (e.clientX - rect.left - borderLeft - xOffsetInContent) * scaleX;
    const y = (e.clientY - rect.top - borderTop - yOffsetInContent) * scaleY;
    
    return { x, y };
  }

  public tryDrawing(e: PointerEvent) {
    if (this.mouseDown && this.ctx) {
      const { x, y } = this.getCanvasMousePos(e);

      const point = new Point({ xPos: x, yPos: y });
      this.points.push(point);

      this.applyStrokeSettings();
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();

      this.lastX = x;
      this.lastY = y;
    }
  }

  public attachUIListeners(): void {
    this.btnClear?.addEventListener("click", () => {
      this.points = [];
      if(this.startUi) this.startUi.innerText = "---";
      if(this.sequenceUi) this.sequenceUi.innerText = "NO DATA";
      this.updateRender();
    });

    this.btnExport?.addEventListener("click", () => {
      this.exportPathPlanner();
    });

    this.btnQr?.addEventListener("click", () => {
      this.generateQRCode();
    });

    this.btnCloseQr?.addEventListener("click", () => {
      this.qrOverlay?.classList.add("hidden");
    });

    // Hotkeys
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === 'e') this.btnExport?.click();
      if (e.key.toLowerCase() === 'q') this.btnQr?.click();
    });

    this.checkDebug?.addEventListener("change", (e) => {
      this.debugMode = (e.target as HTMLInputElement).checked;
      this.updateRender();
    });
  }

  private exportPathPlanner() {
    if (this.points.length < 2) {
      alert("Please draw a path first!");
      return;
    }

    // FRC 2026 Field is approx 16.54m x 8.21m
    const fieldWidthMeters = 16.54;
    const fieldHeightMeters = 8.21;

    // Helper to map canvas pixels to PathPlanner meters (Origin at Bottom-Left)
    const mapPoint = (pt: Point) => {
      return {
        x: (pt.xPos / this.canvas.width) * fieldWidthMeters,
        y: ((this.canvas.height - pt.yPos) / this.canvas.height) * fieldHeightMeters
      };
    };

    const meterPoints = this.points.map(mapPoint);
    const waypoints: any[] = [];

    for (let i = 0; i < meterPoints.length; i++) {
        const pt = meterPoints[i];
        
        let prevControl = null;
        let nextControl = null;

        // Simple bezier control point generation based on surrounding points
        if (i > 0) {
            const prev = meterPoints[i - 1];
            // Pointing back towards previous
            prevControl = {
                x: pt.x + (prev.x - pt.x) * 0.25,
                y: pt.y + (prev.y - pt.y) * 0.25
            };
        }
        
        if (i < meterPoints.length - 1) {
            const next = meterPoints[i + 1];
            let dirX = next.x - pt.x;
            let dirY = next.y - pt.y;
            
            // If we have a previous point, smoothly interpolate the tangent
            if (i > 0) {
                const prev = meterPoints[i - 1];
                dirX = (next.x - prev.x) * 0.5;
                dirY = (next.y - prev.y) * 0.5;
            }

            nextControl = {
                x: pt.x + dirX * 0.25,
                y: pt.y + dirY * 0.25
            };
        }

        waypoints.push({
            anchor: { x: pt.x, y: pt.y },
            prevControl: prevControl,
            nextControl: nextControl,
            isLocked: false,
            linkedName: null
        });
    }

    const pathPlannerJson = {
      version: 1.0,
      waypoints: waypoints,
      rotationTargets: [],
      constraintZones: [],
      eventMarkers: [],
      globalConstraints: {
        maxVelocity: 3.0,
        maxAcceleration: 3.0,
        maxAngularVelocity: 540,
        maxAngularAcceleration: 720
      },
      goalEndState: {
        velocity: 0,
        rotation: 0,
        behavior: "default"
      },
      reversed: false,
      folder: null,
      previewStartingState: {
        rotation: 0,
        velocity: 0
      },
      useDefaultConstraints: true
    };

    const sequence = this.getPathSequence();
    const fileName = sequence !== "NO DATA" 
      ? sequence.toLowerCase().replace(/ \- /g, "_").replace(/ /g, "_") + ".path"
      : "auton_path.path";

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pathPlannerJson, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", fileName);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    document.body.removeChild(dlAnchorElem);
  }

  private generateQRCode() {
    if (this.points.length < 2) {
      alert("Please draw a path first!");
      return;
    }

    const fieldWidthMeters = 16.54;
    const fieldHeightMeters = 8.21;

    // Compact list of points: X.XX,Y.YY;...
    const dataString = this.points.map(pt => {
      const mx = (pt.xPos / this.canvas.width) * fieldWidthMeters;
      const my = ((this.canvas.height - pt.yPos) / this.canvas.height) * fieldHeightMeters;
      return `${mx.toFixed(2)},${my.toFixed(2)}`;
    }).join(";");

    if ((window as any).QRCode) {
      (window as any).QRCode.toCanvas(this.qrCanvas, dataString, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff"
        }
      }, (error: any) => {
        if (error) {
          console.error("QR Generation Error:", error);
          alert("Failed to generate QR code. Too much data?");
        } else {
          if (this.qrPointCount) this.qrPointCount.innerText = `${this.points.length} WAYPOINTS`;
          this.qrOverlay?.classList.remove("hidden");
        }
      });
    } else {
      alert("QR library not loaded!");
    }
  }

  // Sets up all of the input handeling
  public attachEventListeners(): void {
    this.canvas.addEventListener("pointerdown", (e) => {
      const { x, y } = this.getCanvasMousePos(e);

      this.mouseDown = true;
      this.lastX = x;
      this.lastY = y;
      
      this.points = [new Point({ xPos: this.lastX, yPos: this.lastY })];
      if (this.startUi) {
        this.startUi.innerText = `${Math.round(x)}, ${Math.round(y)}`;
      }
      
      this.updateRender(true);
    });

    this.canvas.addEventListener("pointerup", () => {
      if (this.mouseDown) {
        this.mouseDown = false;
        const epsilon = 3;
        this.points = this.rdp(this.points, epsilon);
        this.updateRender(); // Draw Catmull Rom curve
      }
    });

    this.canvas.addEventListener("pointermove", (e) => {
      const { x, y } = this.getCanvasMousePos(e);

      if (this.coordsUi) {
        this.coordsUi.innerText = `${Math.round(x)}, ${Math.round(y)}`;
      }

      this.tryDrawing(e);
    });
  }

  // Calculate how far a point is from a line segment
private static perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.xPos - lineStart.xPos;
  const dy = lineEnd.yPos - lineStart.yPos;

  // If the line has zero length, just measure direct distance
  if (dx === 0 && dy === 0) {
    return Math.hypot(
      point.xPos - lineStart.xPos,
      point.yPos - lineStart.yPos,
    );
  }

  // Project the point onto the line, t is a 0-1 value representing
  // how far along the segment the closest point is
  const t =
    ((point.xPos - lineStart.xPos) * dx +
      (point.yPos - lineStart.yPos) * dy) /
    (dx * dx + dy * dy);

  // Reconstruct the actual closest point coordinates from t
  const closestX = lineStart.xPos + t * dx;
  const closestY = lineStart.yPos + t * dy;

  return Math.hypot(point.xPos - closestX, point.yPos - closestY);
}

// Ramer-Douglas-Peucker algorithm — recursively simplifies a point array
// by removing points that don't deviate meaningfully from a straight line
private rdp(points: Point[], epsilon: number): Point[] {
  // Base case: can't simplify fewer than 3 points
  if (points.length < 3) return points;

  let maxDist = 0;
  let maxIndex = 0;

  // Find the point furthest from the line between first and last
  for (let i = 1; i < points.length - 1; i++) {
    const dist = FeildCanvas.perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1],
    );
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    // The furthest point is significant — keep it and recurse on both halves
    const left = this.rdp(points.slice(0, maxIndex + 1), epsilon);
    const right = this.rdp(points.slice(maxIndex), epsilon);
    // Trim the duplicate point at the split before joining
    return [...left.slice(0, -1), ...right];
  } else {
    // All middle points are within epsilon of a straight line — discard them
    return [points[0], points[points.length - 1]];
  }
}

  // --- REGION DEFINITIONS (16.54m x 8.21m Field) ---
  private static readonly REGIONS = [
    // Higher priority (more specific) regions first
    { name: "Blue Outpost", type: "rect", x: 0, y: 4.8, w: 1.5, h: 2.2, color: "rgba(0, 240, 255, 0.6)" },
    { name: "Red Outpost", type: "rect", x: 15, y: 1.2, w: 1.5, h: 2.2, color: "rgba(255, 0, 60, 0.6)" },
    
    { name: "Blue Depot", type: "rect", x: 0, y: .5, w: 2.5, h: 1.5, color: "rgba(0, 240, 255, 0.4)" },
    { name: "Red Depot", type: "rect", x: 14.04, y: 6.2, w: 2.5, h: 1.5, color: "rgba(255, 0, 60, 0.4)" },

    { name: "Blue Hub", type: "circle", x: 3.75, y: 4.105, r: 1.1, color: "rgba(0, 240, 255, 0.5)" },
    { name: "Red Hub", type: "circle", x: 13.0, y: 4.105, r: 1.1, color: "rgba(255, 0, 60, 0.5)" },

    { name: "Trench", type: "rect", x: 4.2, y: 6.55, w: 1.2, h: 1.5, color: "rgba(255, 255, 255, 0.2)" },
    { name: "Bump", type: "rect", x: 4.2, y: 4.6, w: 1.2, h: 2, color: "rgba(255, 255, 255, 0.2)" },
    { name: "Trench", type: "rect", x: 4.2, y: 0.0, w: 1.2, h: 1.6, color: "rgba(255, 255, 255, 0.2)" },
    { name: "Bump", type: "rect", x: 4.2, y: 1.6, w: 1.2, h: 2, color: "rgba(255, 255, 255, 0.2)" },
    { name: "Trench", type: "rect", x: 11.1, y: 6.55, w: 1.2, h: 1.5, color: "rgba(255, 255, 255, 0.2)" },
    { name: "Bump", type: "rect", x: 11.1, y: 4.6, w: 1.2, h: 2, color: "rgba(255, 255, 255, 0.2)" },
    { name: "Trench", type: "rect", x: 11.1, y: 0.0, w: 1.2, h: 1.6, color: "rgba(255, 255, 255, 0.2)" },
    { name: "Bump", type: "rect", x: 11.1, y: 1.6, w: 1.2, h: 2, color: "rgba(255, 255, 255, 0.2)" },

    { name: "Neutral Zone", type: "rect", x: 5.5, y: 0, w: 5.5, h: 8.21, color: "rgba(234, 255, 0, 0.3)" },

    { name: "Blue Alliance Zone", type: "rect", x: 0, y: 0, w: 4.25, h: 8.21, color: "rgba(0, 240, 255, 0.2)" },
    { name: "Red Alliance Zone", type: "rect", x: 12.24, y: 0, w: 4.5, h: 8.21, color: "rgba(255, 0, 60, 0.2)" },
  ];

  private getRegionName(x: number, y: number): string {
    for (const reg of FeildCanvas.REGIONS) {
      if (reg.type === "circle") {
        if (Math.hypot(x - reg.x!, y - reg.y!) < reg.r!) return reg.name;
      } else if (reg.type === "rect") {
        if (x >= reg.x! && x <= reg.x! + reg.w! && y >= reg.y! && y <= reg.y! + reg.h!) {
          return reg.name;
        }
      }
    }
    
    // Fallback based on field side
    return "unknown";
  }

  private drawDebugRegions() {
    if (!this.ctx || !this.debugMode) return;
    this.ctx.save();
    
    const fieldWidthMeters = 16.54;
    const fieldHeightMeters = 8.21;
    
    const toCanvasX = (metersX: number) => (metersX / fieldWidthMeters) * this.canvas.width;
    const toCanvasY = (metersY: number) => this.canvas.height - (metersY / fieldHeightMeters) * this.canvas.height;
    const toCanvasSize = (meters: number) => (meters / fieldWidthMeters) * this.canvas.width;

    for (const reg of FeildCanvas.REGIONS) {
      this.ctx.strokeStyle = reg.color;
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([5, 5]);

      if (reg.type === "rect") {
        const cx = toCanvasX(reg.x!);
        const cy = toCanvasY(reg.y! + reg.h!);
        const cw = toCanvasSize(reg.w!);
        const ch = (reg.h! / fieldHeightMeters) * this.canvas.height;
        
        this.ctx.strokeRect(cx, cy, cw, ch);
        this.ctx.fillStyle = reg.color;
        this.ctx.font = "10px Share Tech Mono";
        this.ctx.fillText(reg.name, cx + 5, cy + 12);
      } else if (reg.type === "circle") {
        this.ctx.beginPath();
        this.ctx.arc(toCanvasX(reg.x!), toCanvasY(reg.y!), toCanvasSize(reg.r!), 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.fillStyle = reg.color;
        this.ctx.font = "10px Share Tech Mono";
        this.ctx.fillText(reg.name, toCanvasX(reg.x!) - 15, toCanvasY(reg.y!));
      }
    }

    this.ctx.restore();
  }

  private getPathSequence(): string {
    if (this.points.length === 0) return "NO DATA";
    
    const regions: string[] = [];
    const fieldWidthMeters = 16.54;
    const fieldHeightMeters = 8.21;

    for (const pt of this.points) {
      const x = (pt.xPos / this.canvas.width) * fieldWidthMeters;
      const y = ((this.canvas.height - pt.yPos) / this.canvas.height) * fieldHeightMeters;
      
      const region = this.getRegionName(x, y);
      
      if (regions.length === 0 || regions[regions.length - 1] !== region) {
        regions.push(region);
      }
    }
    
    return regions.slice(0, 12).join(" - "); // Cap at 12 regions for readability
  }
}

const app = new FeildCanvas();

interface PointConstructor {
  xPos: number;
  yPos: number;
}

class Point {
  public readonly xPos: number;
  public readonly yPos: number;

  constructor({ xPos, yPos }: PointConstructor) {
    this.xPos = xPos;
    this.yPos = yPos;
  }
}
