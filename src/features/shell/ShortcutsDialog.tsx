import { Dialog, KeyHint } from '../../components/ui';
import { NAV_ITEMS, REPORT_ITEM } from './nav';

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" size="sm" onClose={onClose}>
      <dl className="shortcuts">
        <div><dt><KeyHint>Ctrl</KeyHint> <KeyHint>K</KeyHint></dt><dd>Search and command palette</dd></div>
        <div><dt><KeyHint>t</KeyHint></dt><dd>Start or stop the session timer</dd></div>
        <div><dt><KeyHint>?</KeyHint></dt><dd>This list</dd></div>
        <div><dt><KeyHint>Esc</KeyHint></dt><dd>Close a dialog</dd></div>
        {[...NAV_ITEMS, REPORT_ITEM].map(item => (
          <div key={item.id}>
            <dt><KeyHint>g</KeyHint> <KeyHint>{item.key}</KeyHint></dt>
            <dd>Go to {item.label}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
