"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Tab } from "@headlessui/react";
import { Image as ImageType } from "@/types";
import GalleryTab from "@/components/gallery/gallery-tab";
import IconButton from "@/components/ui/icon-button";
import {Maximize, Maximize2, X} from "lucide-react";

interface GalleryProps {
    images: ImageType[];
}

const Gallery: React.FC<GalleryProps> = ({ images }) => {
    const [maximizedImage, setMaximizedImage] = useState<string | null>(null);

    const handleMaximize = (url: string) => {
        setMaximizedImage(url);
    };

    const handleClose = () => {
        setMaximizedImage(null);
    };

    return (
        <div>
            <Tab.Group as="div" className="flex flex-col-reverse">
                <div className="mx-auto mt-6 hidden w-full max-w-2xl sm:block lg:max-w-none">
                    <Tab.List className="grid grid-cols-4 gap-6">
                        {images.map((image) => (
                            <GalleryTab key={image.id} image={image} />
                        ))}
                    </Tab.List>
                </div>
                <Tab.Panels className="aspect-square w-full">
                    {images.map((image) => (
                        <Tab.Panel key={image.id}>
                            <div onClick={() => handleMaximize(image.url)} className="aspect-square relative h-full w-full rounded-lg overflow-hidden hover:cursor-pointer">
                                <Image fill src={image.url} alt="Image" className="object-cover object-center" />
                                <button
                                    onClick={() => handleMaximize(image.url)}
                                    className="absolute top-2 right-2 bg-white p-2 rounded-full shadow-md transition-transform transform hover:scale-110"
                                >
                                    <Maximize2 size="18" />
                                </button>
                            </div>
                        </Tab.Panel>
                    ))}
                </Tab.Panels>
            </Tab.Group>

            {maximizedImage && (
               <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                   <div className="relative w-3/4 h-3/4">
                       <Image fill src={maximizedImage} alt="Maximized Image" className="object-contain w-100 h-100" />
                       <button
                           onClick={handleClose}
                           className="absolute top-0 right-0 m-2 bg-white p-2 rounded-full shadow-md transition-transform transform hover:scale-110"
                       >
                           <X size="18" />
                       </button>
                   </div>
               </div>
           )}
        </div>
    );
};

export default Gallery;