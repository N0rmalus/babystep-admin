import { create } from 'zustand';
import { persist, createJSONStorage } from "zustand/middleware";

import { Product } from '@/types';
import toast from 'react-hot-toast';

interface WishlistStore {
  items: Product[];
  addItem: (data: Product) => void;
  removeItem: (id: string) => void;
  removeAll: () => void;
}

const useWishlist = create(
    persist<WishlistStore>((set, get) => ({
        items: [],
        addItem: (data: Product) => {
            const currentItems = get().items;
            const existingItem = currentItems.find((item) => item.id === data.id);

            if(existingItem) {
                return toast("Prekė jau įtraukta į sąrašą.");
            }

            set({ items: [...get().items, data] });
            toast.success("Prekė pridėta į norų sąrašą :).");
        },
        removeItem: (id: string) => {
            set({ items: [...get().items.filter((item) => item.id !== id)] });
            toast.success("Prekė pašalinta iš sąrašo.");
        },
        removeAll: () => set({ items: [] }),
    }), {
        name: "wishlist-storage",
        storage: createJSONStorage(() => localStorage)
    })
);

export default useWishlist;