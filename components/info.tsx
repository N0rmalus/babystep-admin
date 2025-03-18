"use client";

import {Heart, ShoppingCart} from "lucide-react";

import { Product } from "@/types";
import Button from "@/components/ui/button";
import Currency from "@/components/ui/currency";
import useCart from "@/hooks/use-cart";
import useWishlist from "@/hooks/use-wishlist";

interface InfoProps {
    data: Product;
}

const Info:React.FC<InfoProps> = ({
    data
}) => {
    const cart = useCart();
    const wishlist = useWishlist();
    const onAddToCart = () => {
        cart.addItem(data);
    }
    const onAddToWishlist = () => {
        wishlist.addItem(data);
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900"> {data.name} </h1>
            <div className="mt-3 flex items-end justify-between">
                <p className="text-2xl text-gray-900"> 
                    <Currency value={data?.price} />
                </p>
            </div>
            <hr className="my-4" />
            <div className="flex flex-col gap-y-6">
                <div className="flex items-center gap-x-4">
                    <h3 className="font-semibold text-black"> Dydis: </h3>
                    <div>
                        {data?.size?.name} <b> / </b> {data?.size?.value}
                    </div>
                </div>
                <div className="flex items-center gap-x-4">
                    <h3 className="font-semibold text-black"> Spalva: </h3>
                    <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: data?.color.value }} />
                </div>
                <div className="flex items-center gap-x-4">
                    <h3 className="font-semibold text-black"> Kiekis sandėlyje: </h3>
                    <div>
                        {data?.size?.value}
                    </div>
                </div>
                <hr />
                <div>
                    <h3 className="font-semibold text-black"> Aprašymas: </h3>
                    <div className="text-black">
                        {data?.description.length ? (
                            <div className="mt-2 text-justify whitespace-pre-wrap">
                                {data?.description}
                            </div>
                        ) : (
                            <p className="flex mt-2 h-full w-full text-neutral-500"> Aprašymo nėra. </p>
                        )}
                    </div>
                </div>
            </div>
            <div className="mt-10 flex items-center justify-between gap-x-3 text-white">
                <Button onClick={onAddToCart} className="flex items-center gap-x-2">
                    Pridėti
                    <ShoppingCart size="18" />
                </Button>
                <div className="ml-auto">
                    <Button onClick={onAddToWishlist} className="flex items-center gap-x-2">
                        Į Norus <Heart size="18" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default Info;