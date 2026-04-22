interface Props {
  title: string;
}

export const Heading = ({ title }: Props) => {
  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight"> {title} </h2>
    </div>
  );
};
