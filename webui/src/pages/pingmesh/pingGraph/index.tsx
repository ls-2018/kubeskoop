import { useRef, useEffect } from "react"
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';



interface GraphData {
  nodes: any[],
  links: any[]
}

interface PingGraphProps {
  data: any
}

const nodeID = (node: any) => {
  let id = node.name
  switch (node.type) {
    case 'Pod':
      id = `${node.type}/${node.namespace}/${node.name}`
      break
    case 'Node':
      id = `${node.type}/${node.name}`
      break
    case 'IP':
      id = `${node.type}/${node.name}`
      break
  }
  return id
}

const toGraphData = (data: any): GraphData => {
  let nodes = data.nodes
    .map((item: any) => {
      let label = item.name
      switch (item.type) {
        case 'Pod':
          label = `${item.namespace}/${item.name}`
          break
        case 'Node':
          label = item.name
          break
        case 'IP':
          label = item.name
          break
      }
      let id = `${item.type}/${label}`
      let group = ""
      for (let lat in data.latencies) {
        if(id == nodeID(data.latencies[lat].source)) {
          group = "SRC"
          break
        } else if (id == nodeID(data.latencies[lat].destination)) {
          group = "DST"
          break
        }
      }
      return {
        id: id,
        name: id,
        label: label,
        group: group,
        ...item,
      }
    });
  const links = data.latencies.map((item: any) => {
    return {
      id: item.id,
      source: nodeID(item.source),
      target: nodeID(item.destination),
      latency_avg: item.latency_avg < 9000? item.latency_avg.toFixed(3) : "failed",
      latency_max: item.latency_max < 9000? item.latency_max.toFixed(3) : "failed",
      latency_min: item.latency_min < 9000? item.latency_min.toFixed(3) : "failed",
      curvature: 0.3,
    }
  });
  return {
    nodes,
    links,
  };
}

const PingGraph: React.FC<PingGraphProps> = (props: PingGraphProps): JSX.Element => {
  const ref = useRef(null);
  const { data } = props
  const graphData = data ? toGraphData(data) : null
  useEffect(() => {
    const fg = ref.current;
    if(fg == null){
      return
    }
    fg.d3Force('link').distance(link => 200);

    fg.d3Force('x', d3.forceX().x(node => node.targetX || 0).strength(0.2));
    fg.d3Force('y', d3.forceY().y(node => 0).strength(0.2));
    fg.d3Force('charge', d3.forceManyBody().strength(-100))

  }, []);
  return (
    <div style={{
      position: "relative",
      height: "600px",
      width: "1300px",
      display: "inline-flex",
    }}>
      <div style={{
        height: "600px",
        width: "1300px",
      }}>
      <ForceGraph2D ref={ref} graphData={graphData}
                    linkCurveRotation="rotation"
                    linkDirectionalArrowLength={3}
                    linkDirectionalArrowRelPos={1}
                    linkDirectionalParticles={2}
                    linkCurvature={0.1}
                    nodeRelSize={6}
                    width={1300}
                    height={600}
                    enableNodeDrag={true}
                    onNodeDragEnd={node => {
                      node.fx = node.x;
                      node.fy = node.y;
                    }}
                    nodeLabel={(node) => node.name}
                    nodeCanvasObjectMode={() => 'after'}
                    nodeCanvasObject={(node, ctx, globalScale) => {
                      if(node.group === "SRC") {
                        node.targetX = -60;
                      } else if(node.group === "DST") {
                        node.targetX = 60;
                      }
                      const label = node.name;
                      const fontSize = 12 / globalScale;
                      ctx.font = `${fontSize}px Sans-Serif`;
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillStyle = 'black'; //node.color;
                      ctx.fillText(label, node.x, node.y + 6);
                    }}
                    linkCanvasObjectMode={() => 'after'}
                    linkLabel={(link) => `${link.source.name}->${link.target.name} max/avg/min ${link.latency_max}/${link.latency_avg}/${link.latency_min} ms`}
                    linkColor={(link) => {
                      if (link.latency_avg === "failed") {
                        return 'red'
                      }
                      return link.latency_avg > 1 ? (link.latency_avg > 100 ? 'red' : 'orange') : 'green'
                    }}
                    linkCanvasObject={(link, ctx) => {
                      const MAX_FONT_SIZE = 4;
                      const LABEL_NODE_MARGIN = 6 * 1.5;
                      const start = link.source;
                      const end = link.target;
                      // ignore unbound links
                      if (typeof start !== 'object' || typeof end !== 'object') return;
                      // calculate label positioning
                      function getQuadraticXY(t, sx, sy, cp1x, cp1y, ex, ey) {
                        return {
                          x: (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cp1x + t * t * ex,
                          y: (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cp1y + t * t * ey,
                        };
                      }
                      let textPos = Object.assign({},...['x', 'y'].map(c => ({
                        [c]: start[c] + (end[c] - start[c]) / 2 // calc middle point
                      })));
                      if (+link.curvature > 0) {
                        textPos = getQuadraticXY(
                          0.5,
                          start.x,
                          start.y,
                          link.__controlPoints[0],
                          link.__controlPoints[1],
                          end.x,
                          end.y
                        );
                      }

                      const relLink = { x: end.x - start.x, y: end.y - start.y };
                      const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;
                      let textAngle = Math.atan2(relLink.y, relLink.x);
                      // maintain label vertical orientation for legibility
                      if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
                      if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);
                      const label = link.latency_avg==="failed"? "failed" : `${link.latency_avg}ms`;
                      // estimate fontSize to fit in link length
                      ctx.font = '1px Sans-Serif';
                      const fontSize = Math.min(MAX_FONT_SIZE, maxTextLength / ctx.measureText(label).width);
                      ctx.font = `${fontSize}px Sans-Serif`;
                      const textWidth = ctx.measureText(label).width;
                      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
                      // draw text label (with background rect)
                      ctx.save();
                      ctx.translate(textPos.x, textPos.y);
                      ctx.rotate(textAngle);
                      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                      ctx.fillRect(- bckgDimensions[0] / 2, - bckgDimensions[1] / 2, ...bckgDimensions);
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillStyle = 'darkgrey';
                      ctx.setLineDash([5, 5]);
                      ctx.fillText(label, 0, 0);
                      ctx.restore();
                    }}
      />
      </div>
      <div style={{float: 'right', width: '200px', position: 'absolute', top: '0px', right: '0px'}}>
        <div><span style={{color: 'red'}}>---  </span><span>latency &gt; 100ms or failed</span></div>
        <div><span style={{color: 'orange'}}>---  </span><span>1ms &lt; latency &lt; 100ms</span></div>
        <div><span style={{color: 'green'}}>---  </span><span>latency &lt; 1ms</span></div>
      </div>
    </div>
  )
}

export default PingGraph;
