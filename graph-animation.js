// graph-animation.js
"use strict";

class Graph {
    constructor(svg) {
        this.idealNumNodes = 69; // Increase the number of nodes for more frequent appearance
        this.extraEdgeProportion = 1; // Increase edge density
        this.radiiWeightPower = 0;
        this.driftSpeed = 0.1; // Increase speed significantly
        this.repulsionForce = 0;
        this.fadeInPerFrame = 0.1; // Increase fade-in speed for quicker appearance
        this.fadeOutPerFrame = -0.05; // Increase fade-out speed for quicker disappearance
        this.nodes = [];
        this.edges = [];
        this.svgElem = svg;
        this.initGraph();
    }

    initGraph() {
        this.setDimensions();
        this.redrawOutput();
        this.startAnimation();
    }

    setDimensions() {
        let br = this.svgElem.getBoundingClientRect();
        this.relWidth = br.width / Math.max(br.width, br.height);
        this.relHeight = br.height / Math.max(br.width, br.height);
        this.svgElem.setAttribute("viewBox", `0 0 ${this.relWidth} ${this.relHeight}`);
    }

    startAnimation() {
        setInterval(() => {
            this.stepFrame();
            this.redrawOutput();
        }, 20); // Adjust frame interval for smoother or faster animation
    }

    stepFrame() {
        this.updateNodes();
        this.updateEdges();
    }

    updateNodes() {
        let newNodes = [];
        let curIdealNumNodes = Math.min(Math.floor(this.nodes.length + 2), this.idealNumNodes); // Increase node creation frequency

        for (let node of this.nodes) {
            // Move based on constant velocity
            node.posX += node.velX * this.driftSpeed;
            node.posY += node.velY * this.driftSpeed;

            // Remove nodes that go off-screen
            if (node.posX > 0 && node.posX < this.relWidth && node.posY > 0 && node.posY < this.relHeight) {
                node.fade(newNodes.length < curIdealNumNodes ? this.fadeInPerFrame : this.fadeOutPerFrame);
                if (node.opacity > 0) newNodes.push(node);
            }
        }

        // Add new nodes to replace those that went off-screen
        while (newNodes.length < curIdealNumNodes) {
            const angle = Math.random() * 2 * Math.PI;
            const speed = 0.03 + Math.random() * 0.02; // Increase speed further
            newNodes.push(new GNode(
                Math.random() * this.relWidth,
                Math.random() * this.relHeight,
                (Math.pow(Math.random(), 5) + 0.35) * 0.005,
                Math.cos(angle) * speed, // Set constant velocity in random direction
                Math.sin(angle) * speed
            ));
        }

        this.nodes = newNodes;
        this.doForceField();
    }

    doForceField() {
        for (let i = 0; i < this.nodes.length; i++) {
            let a = this.nodes[i];
            a.dPosX = 0;
            a.dPosY = 0;
            for (let j = 0; j < i; j++) {
                let b = this.nodes[j];
                let dx = a.posX - b.posX;
                let dy = a.posY - b.posY;
                const distSqr = dx * dx + dy * dy;
                const factor = this.repulsionForce / (Math.sqrt(distSqr) * (distSqr + 0.00001));
                dx *= factor;
                dy *= factor;
                a.dPosX += dx;
                a.dPosY += dy;
                b.dPosX -= dx;
                b.dPosY -= dy;
            }
        }
        for (let node of this.nodes) {
            node.posX += node.dPosX;
            node.posY += node.dPosY;
        }
    }

    updateEdges() {
        let allEdges = this.calcAllEdgeWeights();
        const idealNumEdges = Math.round((this.nodes.length - 1) * (1 + this.extraEdgeProportion));
        let idealEdges = this.calcSpanningTree(allEdges);

        let newEdges = [];
        for (let edge of this.edges) {
            edge.fade(Graph.containsEdge(idealEdges, edge) ? this.fadeInPerFrame : this.fadeOutPerFrame);
            if (Math.min(edge.opacity, edge.nodeA.opacity, edge.nodeB.opacity) > 0) newEdges.push(edge);
        }

        for (const edge of idealEdges) {
            if (newEdges.length >= idealNumEdges) break;
            if (!Graph.containsEdge(newEdges, edge)) newEdges.push(edge);
        }

        this.edges = newEdges;
    }

    calcAllEdgeWeights() {
        let result = [];
        for (let i = 0; i < this.nodes.length; i++) {
            const a = this.nodes[i];
            for (let j = 0; j < i; j++) {
                const b = this.nodes[j];
                let weight = Math.hypot(a.posX - b.posX, a.posY - b.posY);
                weight /= Math.pow(a.radius * b.radius, this.radiiWeightPower);
                result.push([weight, i, j]);
            }
        }
        return result.sort((a, b) => a[0] - b[0]);
    }

    calcSpanningTree(allEdges) {
        let result = [];
        let ds = new DisjointSet(this.nodes.length);
        for (const [_, i, j] of allEdges) {
            if (ds.mergeSets(i, j)) {
                result.push(new GEdge(this.nodes[i], this.nodes[j]));
                if (result.length >= this.nodes.length - 1) break;
            }
        }
        return result;
    }

    redrawOutput() {
        let gElem = this.svgElem.querySelector("g");
        while (gElem.firstChild !== null) gElem.removeChild(gElem.firstChild);

        for (const node of this.nodes) {
            gElem.append(this.createSvgElem("circle", {
                "cx": node.posX,
                "cy": node.posY,
                "r": node.radius, // Thinner node radius
                "fill": "rgba(129,139,197," + node.opacity.toFixed(3) + ")",
            }));
        }

        for (const edge of this.edges) {
            const a = edge.nodeA;
            const b = edge.nodeB;
            let dx = a.posX - b.posX;
            let dy = a.posY - b.posY;
            const mag = Math.hypot(dx, dy);
            if (mag > a.radius + b.radius) {
                dx /= mag;
                dy /= mag;
                const opacity = Math.min(Math.min(a.opacity, b.opacity), edge.opacity);
                gElem.append(this.createSvgElem("line", {
                    "x1": a.posX - dx * a.radius,
                    "y1": a.posY - dy * a.radius,
                    "x2": b.posX + dx * b.radius,
                    "y2": b.posY + dy * b.radius,
                    "stroke": "rgba(129,139,197," + opacity.toFixed(3) + ")",
                    "stroke-width": "0.001" // Thinner edge stroke width
                }));
            }
        }
    }

    createSvgElem(tag, attribs) {
        let result = document.createElementNS(this.svgElem.namespaceURI, tag);
        for (const key in attribs) result.setAttribute(key, attribs[key].toString());
        return result;
    }

    static containsEdge(edges, edge) {
        for (const e of edges) {
            if (e.nodeA == edge.nodeA && e.nodeB == edge.nodeB || e.nodeA == edge.nodeB && e.nodeB == edge.nodeA)
                return true;
        }
        return false;
    }
}

class GObject {
    constructor() {
        this.opacity = 0.0;
    }

    fade(delta) {
        this.opacity = Math.max(Math.min(this.opacity + delta, 1.0), 0.0);
    }
}

class GNode extends GObject {
    constructor(posX, posY, radius, velX, velY) {
        super();
        this.posX = posX;
        this.posY = posY;
        this.radius = radius;
        this.velX = velX;
        this.velY = velY;
        this.dPosX = 0;
        this.dPosY = 0;
    }
}

class GEdge extends GObject {
    constructor(nodeA, nodeB) {
        super();
        this.nodeA = nodeA;
        this.nodeB = nodeB;
    }
}

class DisjointSet {
    constructor(size) {
        this.parents = [];
        this.ranks = [];
        for (let i = 0; i < size; i++) {
            this.parents.push(i);
            this.ranks.push(0);
        }
    }

    mergeSets(i, j) {
        const repr0 = this.getRepr(i);
        const repr1 = this.getRepr(j);
        if (repr0 == repr1) return false;
        const cmp = this.ranks[repr0] - this.ranks[repr1];
        if (cmp >= 0) {
            if (cmp == 0) this.ranks[repr0]++;
            this.parents[repr1] = repr0;
        } else this.parents[repr0] = repr1;
        return true;
    }

    getRepr(i) {
        if (this.parents[i] != i) this.parents[i] = this.getRepr(this.parents[i]);
        return this.parents[i];
    }
}

document.addEventListener("DOMContentLoaded", () => {
    let svg = document.getElementById("graph-bg");
    if (svg) {
        new Graph(svg);
    }
});
