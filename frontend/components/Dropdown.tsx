"use client";

import * as React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { RowSpacingIcon, Cross2Icon } from "@radix-ui/react-icons";

const Dropdown = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible.Root className="w-[400px]" open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between">
        <span className="text-[17px] leading-[30px] text-white">
          Click on the dropdown button for more information:
        </span>
        <Collapsible.Trigger asChild>
          <button className="inline-flex size-[35px] items-center justify-center rounded-full text-violet11 shadow-[0_2px_10px] shadow-blackA4 outline-none hover:bg-violet3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[state=closed]:bg-white data-[state=open]:bg-violet3">
            {open ? <Cross2Icon /> : <RowSpacingIcon />}
          </button>
        </Collapsible.Trigger>
      </div>

      <div className="my-3 h-40 rounded-lg bg-black/40 backdrop-blur-md border border-white/30 p-4 shadow-2xl">
        <span className="text-[15px] leading-[25px] text-white">Text</span>
      </div>

      <Collapsible.Content>
        <div className="my-3 h-40 rounded-lg bg-black/40 backdrop-blur-md border border-white/30 shadow-2xl p-4">
          <span className="text-[15px] leading-[25px] text-white">Text2</span>
        </div>
        <div className="my-3 h-40 rounded-lg bg-black/40 backdrop-blur-md border border-white/30 shadow-2xl p-4">
          <span className="text-[15px] leading-[25px] text-white">Text3</span>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

export default Dropdown;
