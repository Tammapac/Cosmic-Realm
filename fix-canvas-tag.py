#!/usr/bin/env python3
"""Fix: change the game container <div> back to <canvas> tag."""

with open('frontend/src/App.tsx', 'r') as f:
    code = f.read()

# Only replace the specific game canvas div - identified by its ref and className
old = '''    <div
      ref={canvasRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: "crosshair", display: "block" }}
    />'''

new = '''    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: "crosshair", display: "block" }}
    />'''

code = code.replace(old, new)

with open('frontend/src/App.tsx', 'w') as f:
    f.write(code)

print("Fixed: <div> -> <canvas> for game element only")
