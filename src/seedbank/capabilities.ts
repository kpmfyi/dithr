/// <reference types="@webgpu/types" />

/** An exposed navigator.gpu is not proof that a device can submit work. */
export async function probeWebGPU(): Promise<{ supported: boolean; reason?: string }> {
  if (!navigator.gpu) return { supported: false, reason: 'WebGPU is not exposed. Use a secure origin and a supported browser.' };
  let device: GPUDevice | undefined;
  let context: GPUCanvasContext | null = null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: false, reason: 'No WebGPU adapter is available.' };
    device = await adapter.requestDevice();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
    context = canvas.getContext('webgpu');
    if (!context) return { supported: false, reason: 'A WebGPU canvas context is unavailable.' };
    context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 1, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    pass.end(); device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    const copy = document.createElement('canvas'); copy.width = copy.height = 2;
    const ctx = copy.getContext('2d')!; ctx.drawImage(canvas, 0, 0);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    if (pixel[0] < 250 || pixel[1] > 5 || pixel[2] > 5) return { supported: false, reason: 'WebGPU did not produce the expected test frame.' };
    return { supported: true };
  } catch (error) {
    return { supported: false, reason: `WebGPU device check failed: ${(error as Error).message}` };
  } finally { context?.unconfigure(); device?.destroy(); }
}
