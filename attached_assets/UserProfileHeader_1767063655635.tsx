import { Star } from "lucide-react";

interface UserProfileHeaderProps {
  name: string;
  lastName: string;
  rating: number;
  imageUrl?: string;
}

export function UserProfileHeader({ name, lastName, rating, imageUrl }: UserProfileHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-[76px] h-[74px] rounded-full overflow-hidden bg-gray-200">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center text-white text-2xl font-bold">
                {name.charAt(0)}
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-[#393939] text-[29px] leading-[27px]">{name}</h1>
          <p className="font-normal text-[#393939] text-[29px] leading-[27px]">{lastName}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-[67px] w-[11px] rounded-[4px]" 
          style={{ 
            backgroundImage: "linear-gradient(180deg, rgba(108, 244, 0, 1) 0%, rgba(108, 244, 0, 0.8) 50%, rgba(254, 158, 15, 0.4) 100%)" 
          }} 
        />
        <div className="bg-[#ffdf6d] rounded-[4px] px-3 py-2 flex items-center gap-1">
          <span className="font-extrabold text-white text-[32px] leading-none">{rating}</span>
          <Star className="w-6 h-6 text-white fill-white" />
        </div>
      </div>
    </div>
  );
}
