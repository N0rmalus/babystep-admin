import { create } from 'zustand';
import { persist, createJSONStorage } from "zustand/middleware"; 

import { Product } from '@/types';
import toast from 'react-hot-toast';

interface CartStore {
  items: Product[];
  addItem: (data: Product) => void;
  removeItem: (id: string) => void;
  removeAll: () => void;
}

const useCart = create(
    persist<CartStore>((set, get) => ({
        items: [],
        addItem: (data: Product) => {
            const currentItems = get().items;
            const existingItem = currentItems.find((item) => item.id === data.id);

            if(existingItem) {
                return toast("Prekė jau įtraukta į krepšelį.");
            }

            set({ items: [...get().items, data] }); // Add item to cart
            toast.success("Prekė pridėta į krepšelį."); // Show success message
        },
        removeItem: (id: string) => {
            set({ items: [...get().items.filter((item) => item.id !== id)] });
            toast.success("Prekė pašalinta iš krepšelio.");
        },
        removeAll: () => set({ items: [] }),
    }), {
        name: "cart-storage",
        storage: createJSONStorage(() => localStorage)
    })
);

export default useCart;