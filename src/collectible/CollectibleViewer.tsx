import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, PresentationControls } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Collectible, type CollectibleShape } from './Collectible'

// R3F re-throws render errors (e.g. a texture 404) to the nearest boundary outside the
// Canvas; without one the whole app would blank out. Recovery is via resetKey prop — the
// boundary must NOT be remounted per item (a key would recreate the Canvas and leak WebGL
// contexts until the browser kills them: "THREE.WebGLRenderer: Context Lost").
class ViewerErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }
  render() {
    if (this.state.failed)
      return <div className="center-msg">Falha ao carregar as imagens deste item.</div>
    return this.props.children
  }
}

function SceneEnv() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04)
    scene.environment = env.texture
    return () => {
      scene.environment = null
      env.texture.dispose()
      pmrem.dispose()
      room.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
    }
  }, [gl, scene])
  return (
    <>
      <directionalLight position={[3, 4, 5]} intensity={1.4} castShadow />
      <directionalLight position={[-4, -1, -3]} intensity={0.3} />
    </>
  )
}

// Flip driven by a slightly underdamped spring — same physics feel as dragging and
// releasing. A small x-tilt during the turn keeps thin shapes from vanishing edge-on
// to the camera mid-flip (which reads as a "blink").
function FlipGroup({ flipped, children }: { flipped: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const spring = useRef({ pos: 0, vel: 0 })
  const target = flipped ? Math.PI : 0

  useFrame((_, rawDt) => {
    if (!ref.current) return
    // clamp dt so throttled/dropped frames advance the spring smoothly, never jump it
    const dt = Math.min(rawDt, 1 / 30)
    const s = spring.current
    const stiffness = 34
    const damping = 2 * Math.sqrt(stiffness) * 0.88
    s.vel += (-stiffness * (s.pos - target) - damping * s.vel) * dt
    s.pos += s.vel * dt
    if (Math.abs(s.pos - target) < 0.0005 && Math.abs(s.vel) < 0.0005) {
      s.pos = target
      s.vel = 0
    }
    const phase = Math.sin(s.pos)
    ref.current.rotation.y = s.pos
    ref.current.rotation.x = phase * 0.22
    ref.current.position.y = Math.abs(phase) * 0.12
  })
  return <group ref={ref}>{children}</group>
}

interface Props {
  itemId: string
  shape: CollectibleShape
  frontUrl: string
  backUrl: string | null
}

export function CollectibleViewer({ itemId, shape, frontUrl, backUrl }: Props) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => setFlipped(false), [itemId])
  return (
    <div className="viewer">
      <ViewerErrorBoundary resetKey={itemId}>
        <Canvas dpr={[1, 2]} shadows camera={{ fov: 38, position: [0, 0, 3.7] }}>
          <SceneEnv />
          <PresentationControls
            global
            snap
            speed={1.4}
            polar={[-Math.PI / 3, Math.PI / 3]}
            azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
          >
            <FlipGroup flipped={flipped}>
              <Collectible shape={shape} frontUrl={frontUrl} backUrl={backUrl} />
            </FlipGroup>
          </PresentationControls>
          <ContactShadows position={[0, -1.35, 0]} opacity={0.45} scale={6} blur={2.4} far={2.5} />
        </Canvas>
      </ViewerErrorBoundary>
      {backUrl && (
        <button className="flip-btn" onClick={() => setFlipped((f) => !f)}>
          Virar
        </button>
      )}
    </div>
  )
}
