import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RigidBody,
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

const FRAGMENT_TTL_MS = 2500;
const MAX_FRAGMENTS = 40;

// Shared GPU resources: one geometry + one material for every bag and every fragment
// (8 per break) instead of a fresh pair per mesh.
const fragmentGeometry = new THREE.BoxGeometry(
  TARGET_SIZE[0] / 2,
  TARGET_SIZE[1] / 2,
  TARGET_SIZE[2] / 2,
);
const fragmentMaterial = new THREE.MeshToonMaterial({
  color: "#b5701d",
  gradientMap: toonRamp(),
});

interface Fragment {
  id: number;
  pos: [number, number, number];
  vel: [number, number, number];
  born: number;
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
 * half-size fragments with a radial impulse (three.js ammo-break demo, on rapier).
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
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) {
            frags.push({
              id: fragId.current++,
              pos: [
                at.x + (sx * TARGET_SIZE[0]) / 4,
                at.y + (sy * TARGET_SIZE[1]) / 4,
                at.z + (sz * TARGET_SIZE[2]) / 4,
              ],
              vel: [
                sx * 3 + shooterVel.x * 0.12,
                sy * 2 + 2.5 + shooterVel.y * 0.12,
                sz * 3 + shooterVel.z * 0.12,
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
      {/* debris: no outline pass, no shadow caster, and out of the projectile's
          interaction group so a stray shot never counts as a hit on debris */}
      {fragments.map((f) => (
        <RigidBody
          key={f.id}
          position={f.pos}
          linearVelocity={f.vel}
          colliders="cuboid"
          collisionGroups={interactionGroups(3, [0])}
        >
          <mesh
            geometry={fragmentGeometry}
            material={fragmentMaterial}
            dispose={null}
          />
        </RigidBody>
      ))}
    </>
  );
}
