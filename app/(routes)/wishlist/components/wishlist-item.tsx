"use client";

import Image from "next/image";
import {Expand, ShoppingCart, X} from 'lucide-react';

import { Product } from "@/types";
import IconButton from "@/components/ui/icon-button";
import Currency from "@/components/ui/currency";
import { useRouter } from "next/navigation";
import { MouseEventHandler } from "react";
import usePreviewModal from "@/hooks/use-preview-modal";
import useCart from "@/hooks/use-cart";
import useWishlist from "@/hooks/use-wishlist";

interface ProductCard {
    data: Product;
}

const WishlistCard: React.FC<ProductCard> = ({
    data
}) => {
    const cart = useCart();
    const wishlist = useWishlist();
    const previewModal = usePreviewModal();
    const router = useRouter();
    const handleClick = () => {
        router.push(`/product/${data?.id}`);
    }

    const onPreview: MouseEventHandler<HTMLButtonElement> = (event) => {
        event.stopPropagation();

        previewModal.onOpen(data);
    }

    const onAddToCart: MouseEventHandler<HTMLButtonElement> = (event) => {
        event.stopPropagation();

        cart.addItem(data);
    }

    const onRemoveFromWishlist: MouseEventHandler<HTMLButtonElement> = (event) => {
        event.stopPropagation();

        wishlist.removeItem(data.id);
    }

    return (
        <div onClick={handleClick} className="bg-white group cursor-pointer rounded-xl border p-3 space-y-4">
            {/* Images and Actions */}
            <div className="aspect-square rounded-xl bg-gray-100 relative">
                <Image src={data?.images?.[0]?.url} fill alt="Image" className="aspect-square object-cover rounded-md" />
                <div className="opacity-0 group-hover:opacity-100 transition absolute w-full px-6 bottom-5">
                    <div className="flex gap-x-6 justify-center">
                        <IconButton onClick={onPreview} icon={<Expand size={20} className="text-gray-600" />} />
                        <IconButton onClick={onAddToCart} icon={<ShoppingCart size={20} className="text-gray-600" />} title={"Krepšelis"} />
                        <IconButton onClick={onRemoveFromWishlist} icon={<X size={20} className="text-gray-600" />} title={"Pašalinti"} />
                    </div>
                </div>
            </div>  
            {/* Description */}
            <div>
                <p className="font-semibold text-lg"> {data.name} </p>
                <p className="text-sm text-gray-500"> {data.category?.name} </p>
            </div>
            {/* Price */}
            <div className="flex items-center justify-between">
                <Currency value={data?.price} />
            </div>
        </div>
    );
}

export default WishlistCard;