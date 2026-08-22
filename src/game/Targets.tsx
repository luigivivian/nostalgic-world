import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RigidBody,
  BallCollider,
  CuboidCollider,
  interactionGroups,
} from "@react-three/rapier";
import type { CollisionPayload, RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { toonRamp } from "./toon";
import { useGame } from "./store";
import {
  STATIONS,
  TARGET_SIZE,
  buildStationTargets,
  stationById,
  type TargetDef,
} from "./stations";
import { SnackBag } from "./assets/SnackBag";

const FRAGMENT_TTL_MS = 2200;
const FRAGMENTS_PER_BREAK = 10;
const MAX_FRAGMENTS = 60;
const FRAG_R = 0.09;
const FRAG_FADE_S = 0.45;

// A broken bag bursts into small glowing "salgadinho" balls that bounce on the ground —
// the same over-white yellow the pickup halos use, so Bloom lifts them on desktop and
// they stay bright flat yellow on the LOW_END tier. One geometry + one material for
// every ball, drawn as ONE InstancedMesh that copies the rapier body poses each frame.
const fragmentGeometry = new THREE.IcosahedronGeometry(FRAG_R, 1);
const fragmentMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(2.1, 1.7, 0.45),
  toneMapped: false,
});

interface Fragment {
  id: number;
  pos: [number, number, number];
  vel: [number, number, number];
  born: number;
}

/** The debris bodies (physics only) plus the single mesh that draws them all. */
function Fragments({ fragments }: { fragments: Fragment[] }) {
  const bodies = useRef(new Map<number, RapierRigidBody>());
  const mesh = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }),
    [],
  );
  useFrame(() => {
    const im = mesh.current;
    if (!im) return;
    const now = performance.now();
    let n = 0;
    for (const f of fragments) {
      const body = bodies.current.get(f.id);
      if (!body) continue;
      const t = body.translation();
      const r = body.rotation();
      // shrink out over the last half second instead of popping
      const left = (f.born + FRAGMENT_TTL_MS - now) / 1000;
      const k = Math.max(0.001, Math.min(1, left / FRAG_FADE_S));
      scratch.p.set(t.x, t.y, t.z);
      scratch.q.set(r.x, r.y, r.z, r.w);
      scratch.s.setScalar(k);
      im.setMatrixAt(n++, scratch.m.compose(scratch.p, scratch.q, scratch.s));
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (n) im.computeBoundingSphere();
  });
  return (
    <>
      {fragments.map((f) => (
        <RigidBody
          key={f.id}
          ref={(b) => {
            if (b) bodies.current.set(f.id, b);
            else bodies.current.delete(f.id);
          }}
          position={f.pos}
          linearVelocity={f.vel}
          colliders={false}
          collisionGroups={interactionGroups(3, [0])}
        >
          <BallCollider args={[FRAG_R]} restitution={0.55} friction={0.8} />
        </RigidBody>
      ))}
      <instancedMesh
        ref={mesh}
        args={[fragmentGeometry, fragmentMaterial, MAX_FRAGMENTS]}
        count={0}
        frustumCulled={false}
        dispose={null}
      />
    </>
  );
}

// One silhouette per tier so the three stations read as different target families at a
// glance, not as the same rack re-skinned: single 30g bag on the beach wall, a squat
// wide "lanchinho" multipack on the rails, a tall "família" bag on the pendulums.
const poleGeometry = new THREE.CylinderGeometry(0.07, 0.09, 1, 8);
const poleMaterial = new THREE.MeshToonMaterial({
  color: "#7a5230",
  gradientMap: toonRamp(),
});

const FORM: Record<1 | 2 | 3, [number, number, number]> = {
  1: [1, 1, 1],
  2: [1.35, 0.72, 1.15],
  3: [0.8, 1.45, 1],
};

function Target({
  def,
  slug,
  onHit,
}: {
  def: TargetDef;
  slug: string;
  onHit: (def: TargetDef, e: CollisionPayload) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const kinematic = def.motion.kind !== "static";
  const form = FORM[stationById(def.stationId)?.tier ?? 1];
  // scratch objects: the kinematic update runs every frame for every moving bag
  const vec = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, def.yaw, 0), [def.yaw]);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }) => {
    const b = body.current;
    const m = def.motion;
    if (!b || m.kind === "static") return;
    const t = clock.elapsedTime;
    // tangent = the station's local +X in world space (rail axis / swing plane)
    const tx = Math.cos(def.yaw);
    const tz = -Math.sin(def.yaw);
    if (m.kind === "rail") {
      // omega = speed / amp so peak linear speed is exactly `speed` u/s
      const o = Math.sin(t * (m.speed / m.amp) + m.phase) * m.amp;
      vec.set(def.pos[0] + tx * o, def.pos[1], def.pos[2] + tz * o);
      b.setNextKinematicTranslation(vec);
      return;
    }
    const angle = Math.sin(t * m.speed + m.phase) * m.amp;
    const sx = Math.sin(angle) * m.arm;
    vec.set(
      def.pos[0] + tx * sx,
      def.pos[1] + m.arm * (1 - Math.cos(angle)),
      def.pos[2] + tz * sx,
    );
    b.setNextKinematicTranslation(vec);
    // XYZ order with x=0 gives yaw-then-local-roll: the bag tilts with the swing
    euler.set(0, def.yaw, angle);
    b.setNextKinematicRotation(quat.setFromEuler(euler));
  });

  const poleH =
    def.poleFrom !== undefined
      ? def.pos[1] - def.poleFrom - (TARGET_SIZE[1] * form[1]) / 2
      : 0;
  return (
    <>
      {poleH > 0 && (
        <mesh
          geometry={poleGeometry}
          material={poleMaterial}
          position={[def.pos[0], def.poleFrom! + poleH / 2, def.pos[2]]}
          scale={[1, poleH, 1]}
          castShadow
          dispose={null}
        />
      )}
      <RigidBody
        ref={body}
        type={kinematic ? "kinematicPosition" : "fixed"}
        position={def.pos}
        rotation={[0, def.yaw, 0]}
        colliders={false}
        userData={{ target: true, id: def.id }}
        onCollisionEnter={(e) => {
          if (
            (e.other.rigidBody?.userData as { projectile?: boolean })
              ?.projectile
          )
            onHit(def, e);
        }}
      >
        {/* explicit collider: SnackBag's mesh may mount after its texture resolves, and
          colliders="cuboid" only auto-fits geometry present at body creation */}
        <CuboidCollider
          args={[
            (TARGET_SIZE[0] * form[0]) / 2,
            (TARGET_SIZE[1] * form[1]) / 2,
            (TARGET_SIZE[2] * form[2]) / 2,
          ]}
        />
        <group scale={form}>
          <SnackBag slug={slug} variant={def.id % 4} />
        </group>
      </RigidBody>
    </>
  );
}

export interface TargetsHandle {
  breakAll: () => void;
}

interface Props {
  /** collection slug — picks the EMBALAGEM scans printed on the bags */
  slug: string;
  /** Called once per broken bag with the drop position and the projectile that hit it. */
  onBreak: (
    def: TargetDef,
    pos: [number, number, number],
    projectileId: number,
  ) => void;
  /** Filled with a breakAll() used by the debug/test hooks. */
  handle?: React.MutableRefObject<TargetsHandle | null>;
}

/**
 * Every target of every unlocked station. A projectile hit swaps the bag for 8
 * glowing crumb balls with a radial impulse (three.js ammo-break demo, on rapier).
 * Remount (key=round) is the reset: broken/spent sets and fragments go with it.
 */
export function Targets({ slug, onBreak, handle }: Props) {
  const stations = useGame((s) => s.stations);
  const all = useMemo(() => STATIONS.flatMap(buildStationTargets), []);
  const [broken, setBroken] = useState<Set<number>>(() => new Set());
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const fragId = useRef(1);
  // The rapier body outlives the React state update by a frame or two, so the same
  // bag can report several collisions before it unmounts — break each one once.
  const brokenRef = useRef(new Set<number>());
  // Likewise per projectile: the 0.18-wide ball can touch two bags in one physics
  // step — only the first contact counts.
  const spent = useRef(new Set<number>());

  const unlocked = useMemo(
    () => new Set(stations.filter((s) => s.unlocked).map((s) => s.id)),
    [stations],
  );
  const live = all.filter(
    (d) => unlocked.has(d.stationId) && !broken.has(d.id),
  );

  const shatter = useCallback(
    (
      def: TargetDef,
      at: { x: number; y: number; z: number },
      shooterVel: { x: number; y: number; z: number },
      projectileId: number,
    ) => {
      brokenRef.current.add(def.id);
      setBroken((b) => new Set(b).add(def.id));
      const frags: Fragment[] = [];
      const now = performance.now();
      // a fan of balls around the bag centre, staggered in speed/height so they don't
      // leave as one ring; the shot's direction leans the whole burst downrange
      for (let k = 0; k < FRAGMENTS_PER_BREAK; k++) {
        const a = (k / FRAGMENTS_PER_BREAK) * Math.PI * 2 + def.id * 0.37;
        const speed = 1.8 + (k % 4) * 0.55;
        frags.push({
          id: fragId.current++,
          pos: [
            at.x + Math.cos(a) * 0.15,
            at.y + 0.05 + (k % 3) * 0.14,
            at.z + Math.sin(a) * 0.15,
          ],
          vel: [
            Math.cos(a) * speed + shooterVel.x * 0.12,
            2.6 + (k % 3) * 1.1 + shooterVel.y * 0.12,
            Math.sin(a) * speed + shooterVel.z * 0.12,
          ],
          born: now,
        });
      }
      // cap the live rigid-body count: the oldest debris goes first
      setFragments((fs) => [...fs, ...frags].slice(-MAX_FRAGMENTS));
      onBreak(def, [at.x, at.y + 0.4, at.z], projectileId);
    },
    [onBreak],
  );

  const handleHit = useCallback(
    (def: TargetDef, e: CollisionPayload) => {
      const projectileId =
        (e.other.rigidBody?.userData as { id?: number })?.id ?? -1;
      if (brokenRef.current.has(def.id) || spent.current.has(projectileId))
        return;
      spent.current.add(projectileId);
      const at = e.target.rigidBody?.translation() ?? {
        x: def.pos[0],
        y: def.pos[1],
        z: def.pos[2],
      };
      shatter(
        def,
        at,
        e.other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 },
        projectileId,
      );
    },
    [shatter],
  );

  // Debug/test hook: break every live bag at once (worst-case fragment load).
  useEffect(() => {
    if (!handle) return;
    handle.current = {
      breakAll: () => {
        for (const def of all) {
          if (brokenRef.current.has(def.id) || !unlocked.has(def.stationId))
            continue;
          shatter(
            def,
            { x: def.pos[0], y: def.pos[1], z: def.pos[2] },
            { x: 0, y: 0, z: 0 },
            -1,
          );
        }
      },
    };
    return () => {
      handle.current = null;
    };
  }, [handle, all, unlocked, shatter]);

  // fragments decay after a few seconds
  const hasFragments = fragments.length > 0;
  useEffect(() => {
    if (!hasFragments) return;
    const t = setInterval(() => {
      const now = performance.now();
      setFragments((fs) => fs.filter((f) => now - f.born < FRAGMENT_TTL_MS));
    }, 500);
    return () => clearInterval(t);
  }, [hasFragments]);

  useEffect(() => {
    useGame.getState().setDiagnostics({ fragments: fragments.length });
  }, [fragments.length]);

  return (
    <>
      {live.map((d) => (
        <Target key={d.id} slug={slug} def={d} onHit={handleHit} />
      ))}
      {/* debris: no outline pass, and out of the projectile's interaction group so a
          stray shot never counts as a hit on debris */}
      <Fragments fragments={fragments} />
    </>
  );
}
