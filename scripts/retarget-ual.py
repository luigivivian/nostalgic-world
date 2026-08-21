# Retarget Quaternius UAL clips (ual.glb) onto the Luigi rig in "luigi model.blend" and
# export one GLB with the clip names PlayerTPS expects.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/retarget-ual.py -- \
#     "luigi model.blend" public/game/character/ual.glb public/game/character/luigi.glb
#
# Method: per frame, each UAL bone's rotation delta from its own rest pose (armature
# space) is applied to the mapped Luigi bone's rest rotation. Bone local axes never
# matter, only that both rigs rest in the same world pose (both T-pose, feet forward).
# Pelvis translation delta is copied scaled by the pelvis-height ratio.
import bpy, os, sys
from mathutils import Matrix, Vector

blend, ual_glb, out = [os.path.abspath(a) for a in sys.argv[sys.argv.index('--') + 1:][:3]]

CLIPS = ['Idle_Loop', 'Walk_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land']
# UAL bone -> Luigi bone, parents before children
MAP = [
    ('pelvis', 'bip_pelvis'),
    ('spine_01', 'bip_spine_0'),
    ('spine_03', 'bip_spine_1'),
    ('Head', 'bip_head'),
    ('clavicle_l', 'bip_collar_L'), ('upperarm_l', 'bip_upperArm_L'), ('lowerarm_l', 'bip_lowerArm_L'), ('hand_l', 'bip_hand_L'),
    ('clavicle_r', 'bip_collar_R'), ('upperarm_r', 'bip_upperArm_R'), ('lowerarm_r', 'bip_lowerArm_R'), ('hand_r', 'bip_hand_R'),
    ('thigh_l', 'bip_hip_L'), ('calf_l', 'bip_knee_L'), ('foot_l', 'bip_foot_L'), ('ball_l', 'bip_toe_L'),
    ('thigh_r', 'bip_hip_R'), ('calf_r', 'bip_knee_R'), ('foot_r', 'bip_foot_R'), ('ball_r', 'bip_toe_R'),
]
KEEP_MESHES = {
    'luigi_smo_body_main.001', 'luigi_smo_body_main.002', 'luigi_smo_body_main.003', 'luigi_smo_buttons',
    'luigi_smo_cap.001', 'luigi_smo_eyebrows_default.001', 'luigi_smo_hair_cap.001', 'luigi_smo_hand_default_L.001',
    'luigi_smo_hand_default_R.001', 'luigi_smo_mouth_default.001', 'luigi_smo_mustache',
}

bpy.ops.wm.open_mainfile(filepath=blend)
luigi = bpy.data.objects['luigi_smo.qc_skeleton']
for o in list(bpy.data.objects):
    if o is not luigi and o.name not in KEEP_MESHES:
        bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=ual_glb)
ual_objs = [o for o in bpy.data.objects if o not in before]
ual = next(o for o in ual_objs if o.type == 'ARMATURE')

def set_action(arm, action):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = action
    if hasattr(action, 'slots') and len(action.slots):
        ad.action_slot = action.slots[0]

rest_u = {u: ual.data.bones[u].matrix_local.copy() for u, _ in MAP}
rest_l = {l: luigi.data.bones[l].matrix_local.copy() for _, l in MAP}
height_ratio = rest_l['bip_pelvis'].translation.z / rest_u['pelvis'].translation.z
print('pelvis height ratio', round(height_ratio, 2))

for pb in luigi.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.matrix_basis = Matrix.Identity(4)

scene = bpy.context.scene
for name in CLIPS:
    src = bpy.data.actions[name]
    set_action(ual, src)
    f0, f1 = int(src.frame_range[0]), int(round(src.frame_range[1]))
    if luigi.animation_data: luigi.animation_data.action = None
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        pose_l = {}  # tracked armature-space target matrices, parents first
        for u, l in MAP:
            pb_u = ual.pose.bones[u]
            delta = pb_u.matrix.to_3x3() @ rest_u[u].to_3x3().inverted()
            rot = delta @ rest_l[l].to_3x3()
            pb_l = luigi.pose.bones[l]
            parent = pb_l.parent
            if parent is None:
                t = rest_l[l].translation + (pb_u.matrix.translation - rest_u[u].translation) * height_ratio
                target = Matrix.Translation(t) @ rot.to_4x4()
                basis = rest_l[l].inverted() @ target
            else:
                parent_pose = pose_l[parent.name]
                local_rest = parent.bone.matrix_local.inverted() @ rest_l[l]
                t = (parent_pose @ local_rest).translation
                target = Matrix.Translation(t) @ rot.to_4x4()
                basis = local_rest.inverted() @ parent_pose.inverted() @ target
            pose_l[l] = target
            pb_l.matrix_basis = basis
            pb_l.keyframe_insert('rotation_quaternion', frame=f)
            if parent is None:
                pb_l.keyframe_insert('location', frame=f)
    act = luigi.animation_data.action
    act.name = name
    act.use_fake_user = True
    track = luigi.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, f0, act)
    luigi.animation_data.action = None
    print('retargeted', name, f1 - f0 + 1, 'frames')

for o in ual_objs:
    bpy.data.objects.remove(o, do_unlink=True)

# face -Z in the export: the .blend has the rig yawed -20 deg
luigi.rotation_euler = (0, 0, 0)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = luigi
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True,
)
print('wrote', out, os.path.getsize(out))
