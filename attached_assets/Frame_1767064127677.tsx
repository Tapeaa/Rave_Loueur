import { CheckIcon } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const tripData = [
  {
    id: 1,
    type: "Covoiturage",
    destination: "Taravao",
    date: "23h30, 12 août, 2023",
    detail1: "Temps 1h45",
    detail2: "17 KM",
    icon: "/figmaAssets/best-18-4.png",
    status: "complété",
  },
  {
    id: 2,
    type: "Taxi",
    destination: "Morrison Café",
    date: "21h30, 5 août, 2023",
    detail1: "Prix: 4930 XPF",
    detail2: "19 KM",
    icon: "/figmaAssets/2-11.png",
    status: "complété",
  },
  {
    id: 3,
    type: "Covoiturage",
    destination: "Mahina, Pearl Resort",
    date: "13h30, 1 août, 2023",
    detail1: "Temps 45m",
    detail2: "13 KM",
    icon: "/figmaAssets/best-18-4.png",
    status: "complété",
  },
  {
    id: 4,
    type: "Covoiturage",
    destination: "Arue, Erima",
    date: "13h30, 1 août, 2023",
    detail1: "Temps 45m",
    detail2: "13 KM",
    icon: "/figmaAssets/best-18-4.png",
    status: "complété",
  },
];

const filterButtons = [
  { label: "En cours", active: false },
  { label: "Terminée", active: true },
  { label: "Annulée", active: false },
];

export const Frame = (): JSX.Element => {
  return (
    <div className="bg-white overflow-hidden w-full min-w-[420px] min-h-screen relative flex flex-col">
      <header className="flex items-center justify-between px-[21px] pt-[3px] pb-0 h-9">
        <div className="[font-family:'Roboto',Helvetica] font-black text-text text-[15px] tracking-[-0.24px] leading-5">
          9:41
        </div>
        <div className="flex items-center gap-[18px]">
          <img
            className="w-[15px] h-[9px]"
            alt="Cellular connection"
            src="/figmaAssets/cellular-connection.svg"
          />
          <img className="w-3.5 h-2.5" alt="Wifi" src="/figmaAssets/wifi.svg" />
          <img
            className="w-[22px] h-2.5"
            alt="Battery"
            src="/figmaAssets/battery.png"
          />
        </div>
      </header>

      <main className="flex-1 px-[36px] pt-[13px]">
        <div className="flex items-start justify-between mb-[18px]">
          <h1 className="[font-family:'Roboto',Helvetica] font-bold text-neutral-800 text-[29px] leading-[30px] tracking-[0]">
            Mes commandes
          </h1>
          <Badge className="bg-[#ffd84ede] text-[#222222] [font-family:'Roboto',Helvetica] font-black text-2xl leading-[29px] tracking-[0] h-[60px] px-4 rounded-[5px] hover:bg-[#ffd84ede]">
            12
            <span className="[font-family:'Roboto',Helvetica] font-medium text-neutral-800 text-xl leading-[30px] tracking-[0] ml-1">
              trajets
            </span>
          </Badge>
        </div>

        <section className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="[font-family:'Roboto',Helvetica] font-medium text-[#5c5c5c] text-base leading-[29px] tracking-[0]">
              Votre dernier trajet
            </span>
            <span className="[font-family:'Roboto',Helvetica] font-medium text-[#5c5c5c] text-base leading-[29px] tracking-[0]">
              23/07/2023
            </span>
          </div>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none mb-6">
            <CardContent className="p-0 relative">
              <img
                className="w-full h-[136px] object-cover rounded-[10px]"
                alt="Ia ora na e maeva"
                src="/figmaAssets/ia-ora-na-e-maeva-24-2.png"
              />
              <div className="absolute top-0 left-0 right-0 h-[3px]">
                <img
                  className="w-full h-full"
                  alt="Line"
                  src="/figmaAssets/line-176.svg"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-1">
            <h2 className="[font-family:'Roboto',Helvetica] font-medium text-[#5c5c5c] text-base leading-[29px] tracking-[0]">
              Résidence Hinaraurea
            </h2>
            <div className="flex items-center gap-4">
              <span className="[font-family:'Roboto',Helvetica] font-light text-[#5c5c5c] text-[13px] leading-[29px] tracking-[0]">
                4 août - 5h47 2023
              </span>
              <span className="[font-family:'Roboto',Helvetica] text-[#5c5c5c] text-[13px] leading-[29px] tracking-[0]">
                <span className="font-light">Prix: </span>
                <span className="font-normal">3440 XPF</span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <Badge className="bg-[#ffde6d] text-[#5c5c5c] [font-family:'Roboto',Helvetica] font-medium text-xs leading-[29px] tracking-[0] h-auto px-3 py-1 rounded-[10px] hover:bg-[#ffde6d]">
              Covoiturage
            </Badge>
            <div className="[font-family:'Roboto',Helvetica] text-[#343434] text-[13px] leading-[13px] tracking-[0]">
              <div className="font-light leading-[16.5px]">
                23h30, 12 août, 2023
              </div>
              <div>
                <span className="font-light leading-[16.5px]">Temps </span>
                <span className="font-medium leading-[16.5px]">1h45</span>
              </div>
              <div className="font-medium leading-[16.5px]">17 KM</div>
            </div>
            <Button className="bg-[#ffde6d] text-[#5c5c5c] [font-family:'Roboto',Helvetica] font-medium text-sm leading-[29px] tracking-[0] h-[30px] px-4 rounded-[5px] hover:bg-[#ffde6d]">
              nouvelle course
            </Button>
          </div>
        </section>

        <div className="flex items-center gap-3 mb-6">
          {filterButtons.map((button, index) => (
            <Button
              key={index}
              className={`${
                button.active ? "bg-[#ffde6d]" : "bg-[#cdcdcd42]"
              } text-[#5c5c5c] [font-family:'Roboto',Helvetica] font-medium text-sm leading-[29px] tracking-[0] h-[30px] px-4 rounded-[5px] hover:${
                button.active ? "bg-[#ffde6d]" : "bg-[#cdcdcd42]"
              }`}
            >
              {button.label}
            </Button>
          ))}
          <Button className="bg-[#ffde6d] text-[#5c5c5c] [font-family:'Roboto',Helvetica] font-medium text-sm leading-[29px] tracking-[0] h-[30px] px-4 rounded-[5px] hover:bg-[#ffde6d] ml-auto">
            nouvelle course
          </Button>
        </div>

        <div className="space-y-0">
          {tripData.map((trip, index) => (
            <div key={trip.id}>
              <div className="flex items-start gap-4 py-4">
                <div className="flex-shrink-0 w-20 h-[72px] bg-[#ffde6d] rounded-[10px] flex items-center justify-center relative">
                  <img
                    className="w-12 h-12 object-cover"
                    alt={trip.type}
                    src={trip.icon}
                  />
                  <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ffde6d] text-[#5c5c5c] [font-family:'Roboto',Helvetica] font-medium text-xs leading-[29px] tracking-[0] h-auto px-2 py-0 rounded-[10px] hover:bg-[#ffde6d] whitespace-nowrap">
                    {trip.type}
                  </Badge>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="[font-family:'Roboto',Helvetica] font-medium text-[#343434] text-base leading-[13.5px] tracking-[0] underline mb-2">
                    {trip.destination}
                  </h3>
                  <div className="[font-family:'Roboto',Helvetica] text-[#343434] text-[13px] leading-[13px] tracking-[0] space-y-1">
                    <div className="font-light leading-[16.5px]">
                      {trip.date}
                    </div>
                    <div>
                      <span className="font-light leading-[16.5px]">
                        {trip.detail1.includes("Temps") ||
                        trip.detail1.includes("Prix")
                          ? trip.detail1.split(" ")[0] + " "
                          : ""}
                      </span>
                      <span className="font-medium leading-[16.5px]">
                        {trip.detail1.includes("Temps") ||
                        trip.detail1.includes("Prix")
                          ? trip.detail1.split(" ").slice(1).join(" ")
                          : trip.detail1}
                      </span>
                    </div>
                    <div className="font-medium leading-[16.5px]">
                      {trip.detail2}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1">
                    <span className="[font-family:'Roboto',Helvetica] font-light text-[#343434] text-xs text-center leading-[13.5px] tracking-[0]">
                      {trip.status}
                    </span>
                    <CheckIcon className="w-4 h-4 text-green-600" />
                  </div>
                  <Button className="bg-[#ffde6d] text-[#5c5c5c] [font-family:'Roboto',Helvetica] font-medium text-sm leading-[29px] tracking-[0] h-[30px] px-4 rounded-[5px] hover:bg-[#ffde6d] whitespace-nowrap">
                    nouvelle course
                  </Button>
                </div>
              </div>
              {index < tripData.length - 1 && (
                <img
                  className="w-full h-px"
                  alt="Line"
                  src="/figmaAssets/line-180.svg"
                />
              )}
            </div>
          ))}
        </div>
      </main>

      <footer className="flex justify-center py-2">
        <img
          className="w-[89px] h-1"
          alt="Line"
          src="/figmaAssets/line-175.svg"
        />
      </footer>
    </div>
  );
};
