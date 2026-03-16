let toasts = $state<{ id: number; message: string; type: 'info' | 'success' | 'error' }[]>([]);
let nextId = 0;

export function getToasts() {
	return toasts;
}

export function toast(message: string, type: 'info' | 'success' | 'error' = 'info', ms = 4000) {
	const id = nextId++;
	toasts = [...toasts, { id, message, type }];
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
	}, ms);
}

export function dismissToast(id: number) {
	toasts = toasts.filter((t) => t.id !== id);
}
