import UIButton from './UIButton';
import { createText } from '../uiFactory';
import { PopupLayers } from '../PopupLayers';
/**
 * Open a standard in-game confirm modal.
 * Purpose: unify confirm UX and prevent repeated modal wiring across the project.
 */
export function openConfirm(game, opts) {
    const modal = game.modal;
    const layer = modal.useLayer(PopupLayers.CONFIRM);
    const msg = createText(opts.message, 26, 0xffffff, '900');
    msg.anchor.set(0.5);
    msg.position.set(modal.panel.width / 2, 180);
    layer.addChild(msg);
    const btnCancel = new UIButton(opts.cancelText ?? '取消', 220, 86);
    btnCancel.position.set(modal.panel.width / 2 - 240, modal.panel.height - 180);
    btnCancel.on('pointertap', () => modal.close());
    const btnOk = new UIButton(opts.okText ?? '确定', 220, 86);
    btnOk.position.set(modal.panel.width / 2 + 20, modal.panel.height - 180);
    btnOk.on('pointertap', () => {
        modal.close();
        opts.onConfirm();
    });
    layer.addChild(btnCancel, btnOk);
    modal.onClose = () => {
        // Cleanup on close to avoid stale nodes lingering between confirmations.
        modal.clearLayer(PopupLayers.CONFIRM);
    };
    modal.open();
}
