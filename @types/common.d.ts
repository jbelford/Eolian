
interface Closable {

  close(): Promise<void>;

}


type ResolvedResource = {
  authors: string[];
  name: string;
  identifier: Identifier;
};

interface SourceResolver {

  resolve(): Promise<ResolvedResource>;

}