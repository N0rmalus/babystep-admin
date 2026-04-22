interface Props {
  title: string;
}

export const Heading = ({ title }: Props) => {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl"> {title} </h2>
    </div>
  );
};
