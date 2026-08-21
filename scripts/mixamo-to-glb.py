# Merge Mixamo FBX downloads into one rigged GLB with the clip names PlayerTPS expects.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/mixamo-to-glb.py -- \
#     --out public/game/character/luigi.glb \
#     Idle_Loop=~/Downloads/Idle.fbx Walk_Loop=~/Downloads/Walking.fbx \
#     Sprint_Loop=~/Downloads/Running.fbx Jump=~/Downloads/Jump.fbx
#
# The FIRST file must be downloaded "With Skin" (it brings the mesh + textures); the rest
# can be "Without Skin". Every Mixamo export of one character shares the same skeleton, so
# each extra file only donates its action, parked as an NLA track (= one glTF animation,
# named after the key). Textures are embedded in the GLB.
import bpy, os, sys

argv = sys.argv[sys.argv.index('--') + 1:]
out = None
clips = []
i = 0
while i < len(argv):
    if argv[i] == '--out':
        out = os.path.abspath(os.path.expanduser(argv[i + 1]))
        i += 2
        continue
    key, path = argv[i].split('=', 1)
    clips.append((key, os.path.abspath(os.path.expanduser(path))))
    i += 1
assert out and clips, 'need --out file.glb and at least one KEY=file.fbx'

bpy.ops.wm.read_factory_settings(use_empty=True)

def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True, ignore_leaf_bones=True, automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    return new, arm

main_objs, main_arm = import_fbx(clips[0][1])
main_arm.name = 'Armature'
main_arm.animation_data_create()

def park(arm, action, key):
    action.name = key
    track = main_arm.animation_data.nla_tracks.new()
    track.name = key
    track.strips.new(key, int(action.frame_range[0]), action)

first_action = main_arm.animation_data.action
if first_action:
    main_arm.animation_data.action = None
    park(main_arm, first_action, clips[0][0])

for key, path in clips[1:]:
    objs, arm = import_fbx(path)
    action = arm.animation_data.action if arm.animation_data else None
    assert action, f'{path}: no animation found'
    arm.animation_data.action = None
    park(arm, action, key)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)

for o in main_objs:
    if o.type == 'MESH':
        o.select_set(True)
main_arm.select_set(True)
bpy.context.view_layer.objects.active = main_arm

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_skins=True,
    export_yup=True,
    export_image_format='AUTO',
)
print('tracks:', [t.name for t in main_arm.animation_data.nla_tracks])
print('bones:', len(main_arm.data.bones), 'first:', [b.name for b in main_arm.data.bones][:6])
print('wrote', out, os.path.getsize(out), 'bytes')
