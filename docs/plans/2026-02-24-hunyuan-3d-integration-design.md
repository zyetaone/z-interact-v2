# Hunyuan 3D Integration Design

## Goal

Replace the disabled Trellis-2 3D generation with Hunyuan 3D v3.1 Rapid (image-to-3D) via fal.ai. When a user completes a space in the Forge, generate a GLB 3D model from their workspace image and display it in the World scene.

## Architecture

Synchronous generation during space completion. The existing `fal-3d.ts` → `persistGlb` → R2 pipeline is reused with a single endpoint swap. The World scene renders GLB models via Threlte's `<GLTF>` component, falling back to the current textured room corner when no GLB exists.

## Decisions

- **Model:** Hunyuan 3D v3.1 Rapid (`fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d`) — $0.225/gen, image-to-3D, GLB output
- **PBR:** Enabled (+$0.15) for metallic/roughness/normal textures — total $0.375/gen
- **Timing:** Synchronous — user waits ~15-30s during completion
- **Rendering:** GLB replaces room corner on the hex island; room corner is fallback
- **Error handling:** Graceful degradation — GLB failure doesn't block space completion

## Data Flow

```
Forge: Complete Space button
  → completeSpace (ai.remote.ts)
    → resolveImageForFal (ensure public URL for fal.ai)
    → generateGlb (fal-ai/hunyuan-3d → GLB)
    → persistGlb (fal.ai CDN → R2, max 50MB)
    → updateSpace (status='complete', glbUrl=R2 URL)
  → Forge shows "View in World" link

World: +page.server.ts loads models with glbUrl
  → Scene.svelte passes glbUrl to RoomModel
    → RoomModel: glbUrl present ? <GLTF> : room corner fallback
```

## Files to Change

| File                                         | Change                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/lib/server/ai/fal-3d.ts`                | Swap endpoint to `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d`, add `enable_pbr: true` |
| `src/routes/forge/ai.remote.ts`              | Add GLB generation + persist to `completeSpace` command                             |
| `src/routes/forge/forge-workspace.svelte.ts` | Re-add `glbUrl` state, update `complete()` method                                   |
| `src/routes/forge/[spaceId]/+page.svelte`    | Show "Generating 3D..." progress, update completion UI                              |
| `src/lib/components/scene/RoomModel.svelte`  | Add `glbUrl` prop, render `<GLTF>` or room corner fallback                          |
| `src/lib/components/IsometricScene.svelte`   | Pass `glbUrl` through `IslandModel` interface                                       |
| `src/lib/components/scene/Scene.svelte`      | Pass `glbUrl` to RoomModel                                                          |
| `src/routes/world/+page.server.ts`           | Include `glbUrl` in model data                                                      |

## Error Handling

- GLB generation failure: space completes with `glbUrl = null`, World shows room corner
- GLB too large (>50MB): `persistGlb` rejects, same fallback
- fal.ai timeout: caught in `completeSpace`, space still completes without GLB
