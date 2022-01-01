class V {
    constructor(x, y) {
        this.set(x, y);
    }
    set(x, y) {
        this.x = x;
        this.y = y;
    }
    middle(v) {
        return new V((this.x + v.x) * 0.5, (this.y + v.y) * 0.5);
    }
    mult(f) {
        return new V(this.x * f, this.y * f);
    }
    add(v) {
        return new V(this.x + v.x, this.y + v.y);
    }
    sub(v) {
        return new V(this.x - v.x, this.y - v.y);
    }
    lerp(v, f) {
        return this.mult(1 - f).add(v.mult(f));
    }
    lerp3(v1, v2, f) {
        return f < 0.5 ? this.lerp(v1, f * 2) : v1.lerp(v2, (f - 0.5) * 2);
    }
    str() {
        return `${this.x} ${this.y}`;
    }
    step(f) {
        return new V(Math.round(this.x * 1/f) * f, Math.round(this.y * 1/f) * f);
    }
    equal(v) {
        return this.x == v.x && this.y == v.y;
    }
}
const NV_SVGNS = 'http://www.w3.org/2000/svg';
class NV_El {
    constructor(type, ...classList) {
        this.dom = (['linearGradient', 'path', 'stop', 'svg', 'defs'].includes(type)) ?
            this.dom = document.createElementNS(NV_SVGNS, type):
            this.dom = document.createElement(type);
        this.dom.style = "";
        classList.forEach(className => this.dom.classList.add('nv-' + className));
    }
    appendChild(...childs) {
        childs.forEach(child => this.dom.appendChild(child.dom));
    }
    setStyle(style) {
        Object.keys(style).forEach(key => this.dom.style[key] = style[key]);
    }
    appendDom(...doms) {
        doms.forEach(dom => this.dom.appendChild(dom));
    }
    clone(deep) {
        return this.dom.cloneNode(deep);
    }
}

class NV_Link {
    constructor(root, socketIn, socketOut) {
        NV_Link.id = NV_Link.id === undefined ? 0 : NV_Link.id + 1;
        this.root = root;
        this.socketIn = socketIn;
        this.socketOut = socketOut;

        this.gradient = new NV_El('linearGradient');
        this.gradient.appendDom(
            this.socketIn.gradientPoint.clone(false),
            this.socketOut.gradientPoint.clone(false)
        );
        this.gradient.dom.id = `nv-gradient-${NV_Link.id}`;
        this.gradient.dom.setAttribute('gradientUnits', 'userSpaceOnUse');
        this.path = new NV_El('path');
        this.path.dom.setAttribute('stroke', `url(#${this.gradient.dom.id})`);
    }
    update(delta) {
        let tangentSize = 60;
        let p1 = this.root.unscale(this.socketIn.getMiddle().sub(delta));
        let pp1 = p1.add(this.socketIn.tangent.mult(tangentSize));
        let p2 = this.root.unscale(this.socketOut.getMiddle().sub(delta));
        let pp2 = p2.add(this.socketOut.tangent.mult(tangentSize));
        let path = `M${p1.str()} C${pp1.str()} ${pp2.str()} ${p2.str()}`;
        this.path.dom.setAttribute('d', path);
        this.gradient.dom.setAttribute('x1', `${p1.x}`);
        this.gradient.dom.setAttribute('y1', `${p1.y}`);
        this.gradient.dom.setAttribute('x2', `${p2.x}`);
        this.gradient.dom.setAttribute('y2', `${p2.y}`);
    }
}

class NV_Socket {
    constructor(parentNode, type, text, color, tangent) {
        this.type = type;
        this.parentNode = parentNode;
        this.tangent = tangent;
        this.container = new NV_El('div', 'node-socket');
        this.point = new NV_El('div', 'node-socket-point');
        this.gradientPoint = new NV_El('stop');
        this.gradientPoint.dom.setAttribute('offset', this.type == 'out' ? '0%' : '100%');
        if(color != null && color != '') {
            this.point.setStyle({backgroundColor: color});
            this.gradientPoint.dom.setAttribute('stop-color', color);
        } else {
            this.gradientPoint.dom.setAttribute('stop-color', 'black');
        }
        this.container.appendChild(this.point);
        if(text !== null && text !== '') {
            let title = new NV_El('div', 'node-socket-title', 'no-select');
            if(color != null && color != '') {
                title.setStyle({color: color});
            }
            title.dom.innerHTML = text;
            this.container.appendChild(title);
        }
    }
    getMiddle() {
        let pointRect = this.point.dom.getBoundingClientRect();
        let pointSize = new V(pointRect.width, pointRect.height);
        let pointPosition = new V(pointRect.x, pointRect.y);
        return pointPosition.add(pointSize.mult(0.5));
    }
}

class NV_Node {
    constructor(root, index, position) {
        this.root = root;
        this.sockets = { in: [], out: [] };
        this.links = [];
        this.index = index;
        this.positionStart = new V(0, 0);
        this.container = new NV_El('div', 'node');
        let middle = new NV_El('div', 'node-middle');
        this.socketContainer = {
            top: new NV_El('div', 'node-socket-row'),
            bottom: new NV_El('div', 'node-socket-row'),
            left: new NV_El('div', 'node-socket-column'),
            right: new NV_El('div', 'node-socket-column', 'invert')
        };
        this.content = new NV_El('div', 'node-content');
        middle.appendChild(
            this.socketContainer.left, 
            this.content, 
            this.socketContainer.right);
        this.container.appendChild(
            this.socketContainer.top, 
            middle, 
            this.socketContainer.bottom);
        this.position = position;
        this.setPosition(position);
        this.content.dom.onmousedown = (e) => this.dragMouseDown(e);
    }
    setPosition(position) {
        this.position = position.step(10);
        this.container.setStyle({
            left: `${this.position.x}px`,
            top: `${this.position.y}px`
        });
    }
    dragMouseDown(event) {
        event = event || window.event;
        event.preventDefault();
        this.positionStart = this.root.unscale(new V(event.clientX, event.clientY)).sub(this.position);
        document.onmouseup = (e) => this.dragMouseUp(e);
        document.onmousemove = (e) => this.dragMouseMove(e);
    }
    dragMouseMove(event) {
        event = event || window.event;
        event.preventDefault();
        this.setPosition(this.root.unscale(new V(event.clientX, event.clientY)).sub(this.positionStart));
        this.updateLinks();
    }
    dragMouseUp() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
    addSocket(side, text, color) {
        let type = (side == 'top' || side == 'left') ? 'in' : 'out';
        let tangent = new V(
            side == 'left' ? -1 : side == 'right' ? 1 : 0,
            side == 'top' ? -1 : side == 'bottom' ? 1 : 0
        );
        let socket = new NV_Socket(this, type, text, color, tangent);
        this.socketContainer[side].appendChild(socket.container);
        this.sockets[type].push(socket);
    }
    updateLinks() {
        let rect = this.container.dom.parentNode.getBoundingClientRect();
        let delta = new V(rect.x, rect.y);
        this.links.forEach(link => link.update(delta));
    }
}
const NV_THEME = {
    TEST: {
        backgroundColor: '#ffffff',
        gridColor: '#d2d2d2',
        gridSize: '50',
        gridPointPercent: '8',
        nodeTextColor: 'red',
        nodeContentBackgroundColor: 'green',
        nodeSocketBackgroundColor: 'blue',
        nodeDefaultSocketColor: '#151515',
        nodeBorderRadius: '8px',
        nodeSpacing: '8px', 
    },
    LIGHT: {
        backgroundColor: '#ffffff',
        gridColor: '#d2d2d2',
        gridSize: '50',
        gridPointPercent: '8',
        nodeTextColor: '#151515',
        nodeContentBackgroundColor: '#ffffff',
        nodeSocketBackgroundColor: '#f3f3f3',
        nodeDefaultSocketColor: '#151515',
        nodeBorderRadius: '8px',
        nodeSpacing: '8px',  
    },
    DARK: {
        backgroundColor: '#151515',
        gridColor: '#080808',
        gridSize: '50',
        gridPointPercent: '8',
        nodeTextColor: '#eeeeee',
        nodeContentBackgroundColor: '#353535',
        nodeSocketBackgroundColor: '#252525',
        nodeDefaultSocketColor: '#151515',
        nodeBorderRadius: '8px',
        nodeSpacing: '8px',  
    }
}
class NV_Container {
    constructor(parent, theme) {
        this.nodes = [];
        this.links = [];
        this.theme = theme || NV_THEME.TEST; 
        this.positionStart = new V(0, 0);
        this.position = new V(0, 0);
        this.origin = new V(0, 0);
        this.size = 1;
        this.parent = parent;
        
        // Create svg dom for links
        this.background = new NV_El('svg', 'background');
        this.background.dom.setAttribute('svgns', NV_SVGNS);
        this.background.dom.setAttribute('viewbox', `0 0 1 1`);
        this.svgDefs = new NV_El('defs');
        this.background.appendChild(this.svgDefs);

        // Create content dom for all nodes
        this.content = new NV_El('div', 'content', 'no-select');

        // Create main container
        this.container = new NV_El('div', 'container');
        this.container.appendChild(this.background);
        this.container.appendChild(this.content);
        this.parent.appendChild(this.container.dom);
        this.container.dom.onmousedown = (e) => this.dragMouseDown(e);
        this.container.dom.onwheel = (e) => this.zoom(e);

        this.updateTransform();
    }
    addNode(position) {
        let node = new NV_Node(this, this.nodes.length, position);
        this.content.appendChild(node.container);
        this.nodes.push(node);
        return node;
    }
    addLink(socketIn, socketOut) {
        let link = new NV_Link(this, socketIn, socketOut);
        this.svgDefs.appendChild(link.gradient);
        this.background.appendChild(link.path);
        this.links.push(link);
        socketIn.parentNode.links.push(link);
        socketOut.parentNode.links.push(link);
        socketIn.parentNode.updateLinks();
        return link;
    }
    updateTheme() {
        this.nodes.forEach(node => {
            node.container.setStyle({
                backgroundColor: this.theme.nodeSocketBackgroundColor
            })
            node.content.setStyle({
                color: this.theme.nodeTextColor,
                backgroundColor: this.theme.nodeContentBackgroundColor
            });
        });
    }
    updateTransform() {
        let gridColor = this.theme.gridColor.replace('#', '%23');
        let pattern = `<rect x="0" y="0" width="${this.theme.gridPointPercent}" height="${this.theme.gridPointPercent}" fill="${gridColor}"/>`;
        let svgGrid = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${pattern}</svg>`;
        this.container.setStyle({
            backgroundSize: `${this.size * this.theme.gridSize}px ${this.size * this.theme.gridSize}px `,
            backgroundPosition: `${this.position.x * this.size}px ${this.position.y * this.size}px`,
            backgroundColor: this.theme.backgroundColor,
            backgroundImage: `url('data:image/svg+xml,${svgGrid}')`
        });
        this.background.setStyle({
            transform: `scale(${this.size}) translate(${this.position.x}px, ${this.position.y}px)`,
            transformOrigin: `${this.origin.x}px ${this.origin.y}px`
        });
        this.content.setStyle({
            transform: `scale(${this.size}) translate(${this.position.x}px, ${this.position.y}px)`,
            transformOrigin: `${this.origin.x}px ${this.origin.y}px`
        });
        this.updateTheme();
    }
    dragMouseDown(event) {
        if(document.onmouseup != null && document.onmousemove != null) {
            return;
        }
        event = event || window.event;
        event.preventDefault();
        this.positionStart = this.unscale(new V(event.clientX, event.clientY)).sub(this.position);
        document.onmouseup = (e) => this.dragMouseUp(e);
        document.onmousemove = (e) => this.dragMouseMove(e);
    }
    dragMouseMove(event) {
        event = event || window.event;
        event.preventDefault();
        this.position = this.unscale(new V(event.clientX, event.clientY)).sub(this.positionStart);
        this.updateTransform();
    }
    dragMouseUp() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
    zoom(event) {
        event.preventDefault();
        //let rect = this.container.dom.getBoundingClientRect();
        //let delta = new V(rect.x, rect.y);
        //this.origin = new V(event.clientX, event.clientY).add(this.position.sub(delta));
        this.size += event.deltaY * -0.001;
        this.size = Math.min(Math.max(.125, this.size), 4);
        this.updateTransform();
    }
    unscale(v) {
        return v.mult(1/this.size);
    }
    getMousePosition(event) {

    }
}

let colors = {
    main: '#d77d00',
    second: '#ffc107',
};


let container = new NV_Container(document.querySelector('#container'));
let node1 = container.addNode(new V(50, 50));
node1.addSocket('top', 'In', colors.main);
node1.addSocket('top', 'Input 1', null);
node1.addSocket('top', 'Input 2', null);
node1.addSocket('top', 'Input 3', null);
node1.addSocket('bottom', 'Out', 'blue');
node1.addSocket('bottom', 'Output 1', null);
node1.content.dom.innerHTML = 'Horizontal sockets.';

let node2 = container.addNode(new V(200, 200));
node2.addSocket('left', '', colors.main);
node2.addSocket('right', '', colors.main);
let node7 = container.addNode(new V(300, 250));
node7.addSocket('left', '', colors.main);
node7.addSocket('right', '', colors.main);
container.addLink(node2.sockets.out[0], node7.sockets.in[0]);

container.addLink(node1.sockets.out[0], node2.sockets.in[0]);
container.addLink(node1.sockets.out[1], node2.sockets.in[0]);

let node8 = container.addNode(new V(50, 250));
node8.addSocket('left', '', colors.main);
node8.addSocket('right', '', colors.main);
let node9 = container.addNode(new V(150, 350));
node9.addSocket('left', '', colors.main);
node9.addSocket('right', '', colors.main);
container.addLink(node8.sockets.out[0], node9.sockets.in[0]);

let node10 = container.addNode(new V(300, 300));
node10.addSocket('left', '', colors.main);
node10.addSocket('right', '', colors.main);
let node11 = container.addNode(new V(454, 400));
node11.addSocket('left', '', colors.main);
node11.addSocket('right', '', colors.main);
container.addLink(node10.sockets.out[0], node11.sockets.in[0]);

let node3 = container.addNode(new V(50, 400));
node3.addSocket('left', 'In', colors.main);
node3.addSocket('left', 'Input 1', null);
node3.addSocket('left', 'Input 2', null);
node3.addSocket('left', 'Input 3', null);
node3.addSocket('right', 'Out', colors.main);
node3.addSocket('right', 'Output 1', null);
node3.content.dom.innerHTML = 'Vertical sockets';

let node4 = container.addNode(new V(50, 550));
node4.content.dom.innerHTML = 'Node without socket.';

let node5 = container.addNode(new V(50, 630));
node5.addSocket('left', 'In', colors.main);
node5.addSocket('right', 'Out', colors.main);
node5.content.dom.innerHTML = 'Many text row<br>Many text row<br>Many text row<br>';

let node6 = container.addNode(new V(50, 730));
node6.addSocket('left', 'In', colors.main);
node6.addSocket('right', 'Out', colors.main);

container.updateTransform();

let currentThemeIndex = 0;
function ChangeTheme() {
    let button = document.querySelector('#changeTheme');
    let themeKeys = Object.keys(NV_THEME);
    let themeName = themeKeys[currentThemeIndex];
    container.theme = NV_THEME[themeName];
    button.innerText = themeName;
    container.updateTransform();
    currentThemeIndex = (currentThemeIndex + 1) % themeKeys.length;
}
ChangeTheme();
