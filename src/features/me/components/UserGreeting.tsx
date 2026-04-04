interface UserGreetingProps {
  greeting: string;
}

export function UserGreeting({ greeting }: UserGreetingProps) {
  return (
    <div className="px-1">
      <h1 className="text-[2rem] md:text-[2.25rem] font-bold text-neutral-900 leading-tight tracking-tight">
        {greeting}
      </h1>
    </div>
  );
}
