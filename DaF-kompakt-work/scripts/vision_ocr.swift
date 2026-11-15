import Foundation
import Vision
import AppKit
// usage: vision_ocr <outdir> <png>...
// writes <outdir>/<name>.tsv : x0 \t y0(top) \t x1 \t y1 \t text   (normalized 0..1, top-left origin)
let args = CommandLine.arguments
let outdir = args[1]
for path in args.dropFirst(2) {
  let name = (path as NSString).lastPathComponent.replacingOccurrences(of: ".png", with: "")
  let out = "\(outdir)/\(name).tsv"
  if FileManager.default.fileExists(atPath: out) { continue }
  guard let img = NSImage(contentsOfFile: path),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["de-DE"]
  req.usesLanguageCorrection = true
  let h = VNImageRequestHandler(cgImage: cg, options: [:])
  try? h.perform([req])
  var lines: [String] = []
  for o in req.results ?? [] {
    guard let t = o.topCandidates(1).first else { continue }
    let b = o.boundingBox
    lines.append(String(format: "%.4f\t%.4f\t%.4f\t%.4f\t", b.minX, 1-b.maxY, b.maxX, 1-b.minY) + t.string.replacingOccurrences(of: "\t", with: " "))
  }
  try? lines.joined(separator: "\n").write(toFile: out, atomically: true, encoding: .utf8)
}
